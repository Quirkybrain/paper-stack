//! Document watch service (contracts §4 `watch-changed`, §7 normative watch
//! text; models §3 INV-WS-01..08; ADR-006).
//!
//! Two layers:
//!
//! - [`WatchService`] is the deterministic state machine: registrations
//!   (document file + parent directory + validated resource set), the W1
//!   debounce/merge with its replacement-save and resource-invalidation
//!   semantics, and unwatch cleanup. All timing flows through the injectable
//!   [`WatchTimer`] and the notify dependency through the [`WatchBackend`]
//!   trait, so tests drive it with a manual clock and a mock backend (no real
//!   time, no real filesystem events).
//! - [`WatchRuntime`] is the production wiring: a `notify::RecommendedWatcher`
//!   plus one controller thread that owns the service, answers
//!   `watch_document`/`unwatch_document` calls, flushes due W1 windows and
//!   forwards [`WatchChangedPayload`] values to an emitter closure (wired to
//!   the Tauri event by the command layer).
//!
//! Merge rules (contracts §7.2–7.3, §7.6): notify events are hints only. Per
//! `docId`, events are folded into one pending window; every accepted event
//! resets the quiet window W1 (initially 300ms); when the window expires at
//! most one payload is emitted. Document-level operations keep the last
//! observed operation (`removed` then `appeared` is a replacement save →
//! `appeared`); a document-level change takes precedence over a resource
//! change, and among resource changes the most recent one is reported. A
//! payload never carries document content (INV-WS-03).
//!
//! Focus re-check (contracts §7.5): [`focus_recheck_action`] and
//! [`focus_recheck_due`] are pure decision helpers for comparing a fresh
//! `stat` with the last observation; the caller (command layer) performs the
//! stat and the stable read (§7.4).

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use notify::event::{EventKind, ModifyKind, RenameMode};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};

use crate::error::{AppError, ErrorCode};
use crate::models::{WatchChangedPayload, WatchKind};

/// Quiet-window initial value W1 (contracts §7.2; calibratable, frozen for
/// regression tests by fixing it in the test configuration).
pub const QUIET_WINDOW: Duration = Duration::from_millis(300);

/// `paperstack://watch-changed` event name (contracts §4); emitted by the
/// command layer from [`WatchRuntime`] payloads.
pub const EVENT_WATCH_CHANGED: &str = "paperstack://watch-changed";

/// Suggested focus-re-check throttle (models §3.4 P-04; a to-be-validated
/// parameter, not a frozen acceptance threshold).
pub const FOCUS_RECHECK_THROTTLE: Duration = Duration::from_millis(300);

/// How long a runtime call waits for the controller thread before reporting
/// an internal error instead of blocking a caller forever.
const RUNTIME_COMMAND_TIMEOUT: Duration = Duration::from_secs(10);
/// Upper bound for the controller's blocking wait; keeps shutdown checks
/// cheap when a pending window lies far in the future.
const RUNTIME_MAX_WAIT: Duration = Duration::from_secs(60 * 60);

// ---------------------------------------------------------------------------
// Injectable time and backend seams
// ---------------------------------------------------------------------------

/// Clock seam for the debounce windows (production: [`SystemWatchTimer`];
/// tests: [`ManualWatchTimer`]).
pub trait WatchTimer: Send + Sync + fmt::Debug {
    /// Epoch milliseconds UTC (contracts §1.1).
    fn now_ms(&self) -> i64;
}

/// Production timer backed by `std::time`.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemWatchTimer;

impl WatchTimer for SystemWatchTimer {
    fn now_ms(&self) -> i64 {
        system_time_to_ms(SystemTime::now())
    }
}

/// Manually advanced clock for deterministic tests. Cloning shares the same
/// instant so the caller and the service always observe the same time.
#[derive(Debug, Default, Clone)]
pub struct ManualWatchTimer {
    now_ms: Arc<AtomicI64>,
}

impl ManualWatchTimer {
    pub fn new(start_ms: i64) -> Self {
        Self {
            now_ms: Arc::new(AtomicI64::new(start_ms)),
        }
    }

    pub fn set(&self, now_ms: i64) {
        self.now_ms.store(now_ms, Ordering::SeqCst);
    }

    pub fn advance(&self, delta: Duration) {
        let delta_ms = i64::try_from(delta.as_millis()).unwrap_or(i64::MAX);
        self.now_ms.fetch_add(delta_ms, Ordering::SeqCst);
    }
}

impl WatchTimer for ManualWatchTimer {
    fn now_ms(&self) -> i64 {
        self.now_ms.load(Ordering::SeqCst)
    }
}

fn system_time_to_ms(time: SystemTime) -> i64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(duration) => i64::try_from(duration.as_millis()).unwrap_or(i64::MAX),
        Err(_) => 0,
    }
}

/// Watcher backend seam: production wraps `notify::RecommendedWatcher`,
/// tests inject a recording mock. The service never assumes duplicates are
/// safe: it refcounts paths and only asks the backend to watch a path once.
pub trait WatchBackend: Send + fmt::Debug {
    fn watch_path(&mut self, path: &Path) -> Result<(), AppError>;
    fn unwatch_path(&mut self, path: &Path) -> Result<(), AppError>;
}

/// Document-path presence probe consulted at flush time (T-15/D-IT-2).
///
/// A replacement save (`write temp` + `rename over`) makes notify emit the
/// removal event of the *replaced inode* (and the parent directory's
/// `IN_DELETE` for the old name) **after** the `MOVED_TO`/`Create` hints, so
/// "last observed operation wins" alone would report `removed` for a path that
/// exists again. The settled truth within the quiet window is the filesystem:
/// a `removed` hint is only emitted when the document path is still missing at
/// flush. Production probes the filesystem; tests inject a deterministic stub.
pub trait DocPresence: Send + Sync + fmt::Debug {
    fn exists(&self, path: &Path) -> bool;
}

/// Production presence probe (`fs::metadata`).
#[derive(Debug, Default, Clone, Copy)]
pub struct FsDocPresence;

impl DocPresence for FsDocPresence {
    fn exists(&self, path: &Path) -> bool {
        fs::metadata(path).is_ok()
    }
}

/// Calibration parameters of the watch service.
#[derive(Debug, Clone)]
pub struct WatchConfig {
    /// Quiet window W1 (contracts §7.2).
    pub quiet_window: Duration,
}

impl Default for WatchConfig {
    fn default() -> Self {
        Self {
            quiet_window: QUIET_WINDOW,
        }
    }
}

// ---------------------------------------------------------------------------
// Focus re-check helpers (contracts §7.5; pure and testable)
// ---------------------------------------------------------------------------

/// `stat(size + mtimeMs)` of one document, compared against the last
/// observation during a focus re-check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatObservation {
    pub size_bytes: u64,
    pub modified_at_ms: i64,
}

/// What the caller should do for one document during a focus re-check.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FocusRecheckAction {
    /// `size + mtimeMs` match the last observation: no read.
    InSync,
    /// The stat differs (or no baseline exists): run the §7.4 stable read.
    StableRead,
    /// The path no longer exists: treat as `removed`; the stable read path
    /// reports `PS_IO_NOT_FOUND`.
    Missing,
}

/// Reads the focus-re-check stat of `path`; `None` when the path is missing
/// or unreadable (caller maps cancellation separately).
pub fn stat_observation(path: &Path) -> Option<StatObservation> {
    fs::metadata(path).ok().map(|metadata| StatObservation {
        size_bytes: metadata.len(),
        modified_at_ms: metadata
            .modified()
            .map(system_time_to_ms)
            .unwrap_or_default(),
    })
}

/// Pure focus-re-check decision (contracts §7.5; INV-WS-06): only the stat
/// comparison decides whether a stable read is triggered. `last_observed=None`
/// means no baseline exists yet, so a stable read establishes one.
pub fn focus_recheck_action(
    current: Option<StatObservation>,
    last_observed: Option<StatObservation>,
) -> FocusRecheckAction {
    match (current, last_observed) {
        (None, _) => FocusRecheckAction::Missing,
        (Some(_), None) => FocusRecheckAction::StableRead,
        (Some(current), Some(last)) if current == last => FocusRecheckAction::InSync,
        (Some(_), Some(_)) => FocusRecheckAction::StableRead,
    }
}

/// Focus-re-check throttling (models §3.4 P-04): `true` when a re-check is
/// allowed. The throttle is an injectable parameter, not a frozen threshold.
pub fn focus_recheck_due(now_ms: i64, last_recheck_ms: Option<i64>, throttle: Duration) -> bool {
    match last_recheck_ms {
        None => true,
        Some(last) => {
            now_ms.saturating_sub(last) >= i64::try_from(throttle.as_millis()).unwrap_or(i64::MAX)
        }
    }
}

// ---------------------------------------------------------------------------
// Registration and merge state
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct ResourceRegistration {
    canonical: PathBuf,
    /// Path string exactly as registered, echoed in `resourcePath` so the
    /// frontend can map the event back to its own reference.
    registered: String,
}

/// Last observed document-level operation inside one quiet window.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DocOp {
    Modified,
    Removed,
    Appeared,
}

impl DocOp {
    fn kind(self) -> WatchKind {
        match self {
            DocOp::Modified => WatchKind::Modified,
            DocOp::Removed => WatchKind::Removed,
            DocOp::Appeared => WatchKind::Appeared,
        }
    }
}

#[derive(Debug, Clone)]
struct Pending {
    deadline_ms: i64,
    doc_op: Option<DocOp>,
    /// Most recent change per resource path; order is event arrival order.
    resource_changes: Vec<(PathBuf, String)>,
}

#[derive(Debug)]
struct Registration {
    doc_path: PathBuf,
    resources: Vec<ResourceRegistration>,
    pending: Option<Pending>,
}

impl Registration {
    fn record_doc_op(&mut self, op: DocOp, now_ms: i64, window: Duration) {
        let pending = self
            .pending
            .get_or_insert_with(|| Pending::new(now_ms, window));
        pending.restart(now_ms, window);
        // Last observed operation wins: a replacement save is remove+appear,
        // so `appeared` is the final state and `removed` is only reported
        // when no reappearance was observed.
        pending.doc_op = Some(op);
    }

    fn record_resource(
        &mut self,
        canonical: &Path,
        registered: &str,
        now_ms: i64,
        window: Duration,
    ) {
        let pending = self
            .pending
            .get_or_insert_with(|| Pending::new(now_ms, window));
        pending.restart(now_ms, window);
        pending
            .resource_changes
            .retain(|(path, _)| path != canonical);
        pending
            .resource_changes
            .push((canonical.to_path_buf(), registered.to_owned()));
    }
}

impl Pending {
    fn new(now_ms: i64, window: Duration) -> Self {
        Self {
            deadline_ms: now_ms.saturating_add(window_ms(window)),
            doc_op: None,
            resource_changes: Vec::new(),
        }
    }

    /// Every accepted event resets the quiet window (contracts §7.2).
    fn restart(&mut self, now_ms: i64, window: Duration) {
        self.deadline_ms = now_ms.saturating_add(window_ms(window));
    }
}

fn window_ms(window: Duration) -> i64 {
    i64::try_from(window.as_millis()).unwrap_or(i64::MAX)
}

/// Maps one notify event kind to the document-level operation it hints at.
/// `path_index`/`path_count` disambiguate `Rename(Both)`, whose paths are
/// `(from, to)` in that order.
fn change_op(kind: &EventKind, path_index: usize, path_count: usize) -> Option<DocOp> {
    match kind {
        EventKind::Access(_) => None,
        EventKind::Create(_) => Some(DocOp::Appeared),
        EventKind::Remove(_) => Some(DocOp::Removed),
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)) => match (path_index, path_count) {
            (0, 2) => Some(DocOp::Removed),
            (1, 2) => Some(DocOp::Appeared),
            _ => Some(DocOp::Modified),
        },
        EventKind::Modify(ModifyKind::Name(RenameMode::From)) => Some(DocOp::Removed),
        EventKind::Modify(ModifyKind::Name(RenameMode::To)) => Some(DocOp::Appeared),
        EventKind::Modify(_) => Some(DocOp::Modified),
        // Imprecise backends report `Any`/`Other`; keep them as hints so the
        // stable read (not the event) decides what actually changed.
        EventKind::Any | EventKind::Other => Some(DocOp::Modified),
    }
}

/// Watched paths of one registration: the document file, its parent
/// directory (replacement-save detection), each validated resource file and
/// each resource parent directory (resource replacement/removal detection).
fn registration_paths(doc_path: &Path, resources: &[ResourceRegistration]) -> BTreeSet<PathBuf> {
    let mut paths = BTreeSet::new();
    paths.insert(doc_path.to_path_buf());
    if let Some(parent) = doc_path.parent() {
        paths.insert(parent.to_path_buf());
    }
    for resource in resources {
        paths.insert(resource.canonical.clone());
        if let Some(parent) = resource.canonical.parent() {
            paths.insert(parent.to_path_buf());
        }
    }
    paths
}

// ---------------------------------------------------------------------------
// WatchService
// ---------------------------------------------------------------------------

/// Deterministic watch registry: register/replace/unwatch documents, fold
/// notify events into per-`docId` quiet windows and flush confirmed payloads.
#[derive(Debug)]
pub struct WatchService {
    config: WatchConfig,
    timer: Box<dyn WatchTimer>,
    backend: Box<dyn WatchBackend>,
    presence: Box<dyn DocPresence>,
    registrations: BTreeMap<String, Registration>,
    /// Refcount of backend-watched paths across registrations (no leaks, and
    /// a shared parent directory is watched once).
    path_use: BTreeMap<PathBuf, usize>,
}

impl WatchService {
    pub fn new(backend: Box<dyn WatchBackend>) -> Self {
        Self::with_parts(
            WatchConfig::default(),
            Box::new(SystemWatchTimer),
            backend,
            Box::new(FsDocPresence),
        )
    }

    pub fn with_timer(
        config: WatchConfig,
        timer: Box<dyn WatchTimer>,
        backend: Box<dyn WatchBackend>,
    ) -> Self {
        Self::with_timer_and_presence(config, timer, backend, Box::new(FsDocPresence))
    }

    /// Full seam for deterministic tests: injectable clock, backend and
    /// document-presence probe.
    pub fn with_timer_and_presence(
        config: WatchConfig,
        timer: Box<dyn WatchTimer>,
        backend: Box<dyn WatchBackend>,
        presence: Box<dyn DocPresence>,
    ) -> Self {
        Self::with_parts(config, timer, backend, presence)
    }

    fn with_parts(
        config: WatchConfig,
        timer: Box<dyn WatchTimer>,
        backend: Box<dyn WatchBackend>,
        presence: Box<dyn DocPresence>,
    ) -> Self {
        Self {
            config,
            timer,
            backend,
            presence,
            registrations: BTreeMap::new(),
            path_use: BTreeMap::new(),
        }
    }

    /// Registers (or replaces) the watch of `doc_id`: document file + parent
    /// directory + the validated resource set (contracts §7.1). Repeated
    /// calls replace the whole registration; pending document-level changes
    /// survive, resource changes of dropped resources do not.
    pub fn watch_document(
        &mut self,
        doc_id: &str,
        doc_path: &Path,
        resource_paths: &[String],
    ) -> Result<(), AppError> {
        // Only verified/existing files are registered (§7.1); a missing path
        // is `PS_IO_NOT_FOUND` for the command layer.
        let canonical_doc = fs::canonicalize(doc_path).map_err(AppError::from_io_read)?;
        let mut resources: Vec<ResourceRegistration> = Vec::with_capacity(resource_paths.len());
        for raw in resource_paths {
            let canonical = fs::canonicalize(raw).map_err(AppError::from_io_read)?;
            if resources.iter().any(|r| r.canonical == canonical) {
                continue;
            }
            resources.push(ResourceRegistration {
                canonical,
                registered: raw.clone(),
            });
        }

        let new_paths = registration_paths(&canonical_doc, &resources);
        let old_paths = self
            .registrations
            .get(doc_id)
            .map(|registration| registration_paths(&registration.doc_path, &registration.resources))
            .unwrap_or_default();

        // Acquire before release so a backend failure leaves the previous
        // registration intact.
        let mut acquired: Vec<PathBuf> = Vec::new();
        for path in new_paths.difference(&old_paths) {
            if let Err(error) = self.acquire_path(path) {
                for path in acquired.iter().rev() {
                    self.release_path(path);
                }
                return Err(error);
            }
            acquired.push(path.clone());
        }
        for path in old_paths.difference(&new_paths) {
            self.release_path(path);
        }

        let pending = self
            .registrations
            .get(doc_id)
            .and_then(|registration| registration.pending.clone())
            .and_then(|mut pending| {
                pending
                    .resource_changes
                    .retain(|(path, _)| resources.iter().any(|r| &r.canonical == path));
                (pending.doc_op.is_some() || !pending.resource_changes.is_empty())
                    .then_some(pending)
            });

        self.registrations.insert(
            doc_id.to_owned(),
            Registration {
                doc_path: canonical_doc,
                resources,
                pending,
            },
        );
        Ok(())
    }

    /// Removes the registration and every path it solely held (contracts
    /// §7.7; INV-WS-01/08). Unknown `doc_id`s are a no-op success.
    pub fn unwatch_document(&mut self, doc_id: &str) {
        if let Some(registration) = self.registrations.remove(doc_id) {
            for path in registration_paths(&registration.doc_path, &registration.resources) {
                self.release_path(&path);
            }
        }
    }

    /// Folds one notify event into the matching registrations. The event is
    /// only a hint; stable-read decisions remain with the caller (contracts
    /// §7.2, §7.4).
    pub fn handle_notify_event(&mut self, event: &notify::Event) {
        let now = self.timer.now_ms();
        let window = self.config.quiet_window;
        let path_count = event.paths.len();
        for registration in self.registrations.values_mut() {
            for (index, path) in event.paths.iter().enumerate() {
                if path == &registration.doc_path {
                    if let Some(op) = change_op(&event.kind, index, path_count) {
                        registration.record_doc_op(op, now, window);
                    }
                    continue;
                }
                let matched = registration
                    .resources
                    .iter()
                    .find(|resource| &resource.canonical == path)
                    .map(|resource| (resource.canonical.clone(), resource.registered.clone()));
                if let Some((canonical, registered)) = matched {
                    if change_op(&event.kind, index, path_count).is_some() {
                        registration.record_resource(&canonical, &registered, now, window);
                    }
                }
            }
        }
    }

    /// Emits at most one payload per `docId` whose quiet window has expired
    /// (contracts §7.2; INV-WS-02). Payloads never contain content
    /// (INV-WS-03).
    ///
    /// Replacement-save correction (contracts §7.2–7.3; D-IT-2): when the
    /// window's last document operation is `removed` but the path exists again
    /// at flush time, the hint refers to the replaced inode — not to a missing
    /// document — and is reported as `modified`. A genuine deletion reports
    /// `removed` only after the whole quiet window has settled.
    pub fn flush_due(&mut self) -> Vec<WatchChangedPayload> {
        let now = self.timer.now_ms();
        let mut payloads = Vec::new();
        for (doc_id, registration) in self.registrations.iter_mut() {
            let due = registration
                .pending
                .as_ref()
                .is_some_and(|pending| pending.deadline_ms <= now);
            if !due {
                continue;
            }
            let Some(pending) = registration.pending.take() else {
                continue;
            };
            let (kind, resource_path) = match pending.doc_op {
                Some(DocOp::Removed) if self.presence.exists(&registration.doc_path) => {
                    (WatchKind::Modified, None)
                }
                Some(op) => (op.kind(), None),
                None => (
                    WatchKind::Resource,
                    pending
                        .resource_changes
                        .last()
                        .map(|(_, registered)| registered.clone()),
                ),
            };
            payloads.push(WatchChangedPayload {
                doc_id: doc_id.clone(),
                kind,
                resource_path,
                observed_at_ms: now,
            });
        }
        payloads
    }

    /// Time until the next pending window expires, when one exists.
    pub fn next_flush_delay(&self) -> Option<Duration> {
        let now = self.timer.now_ms();
        self.registrations
            .values()
            .filter_map(|registration| registration.pending.as_ref())
            .map(|pending| {
                Duration::from_millis(
                    u64::try_from(pending.deadline_ms.saturating_sub(now).max(0)).unwrap_or(0),
                )
            })
            .min()
    }

    pub fn document_count(&self) -> usize {
        self.registrations.len()
    }

    pub fn is_watched(&self, doc_id: &str) -> bool {
        self.registrations.contains_key(doc_id)
    }

    pub fn pending_count(&self) -> usize {
        self.registrations
            .values()
            .filter(|registration| registration.pending.is_some())
            .count()
    }

    /// Backend-watched path count (leak checks in tests).
    pub fn watched_path_count(&self) -> usize {
        self.path_use.len()
    }

    fn acquire_path(&mut self, path: &Path) -> Result<(), AppError> {
        let needs_watch = match self.path_use.get(path) {
            Some(count) => *count == 0,
            None => true,
        };
        if needs_watch {
            self.backend.watch_path(path)?;
        }
        *self.path_use.entry(path.to_path_buf()).or_insert(0) += 1;
        Ok(())
    }

    fn release_path(&mut self, path: &Path) {
        let remove = match self.path_use.get_mut(path) {
            Some(count) => {
                *count = count.saturating_sub(1);
                *count == 0
            }
            None => false,
        };
        if remove {
            self.path_use.remove(path);
            let _ = self.backend.unwatch_path(path);
        }
    }
}

// ---------------------------------------------------------------------------
// Production runtime
// ---------------------------------------------------------------------------

/// Real notify backend over `notify::RecommendedWatcher`.
#[derive(Debug)]
struct NotifyBackend {
    watcher: RecommendedWatcher,
}

impl WatchBackend for NotifyBackend {
    fn watch_path(&mut self, path: &Path) -> Result<(), AppError> {
        self.watcher
            .watch(path, RecursiveMode::NonRecursive)
            .map_err(|error| {
                AppError::new(ErrorCode::Internal)
                    .with_message("failed to register a filesystem watch")
                    .with_source(error)
            })
    }

    fn unwatch_path(&mut self, path: &Path) -> Result<(), AppError> {
        self.watcher.unwatch(path).map_err(|error| {
            AppError::new(ErrorCode::Internal)
                .with_message("failed to remove a filesystem watch")
                .with_source(error)
        })
    }
}

enum RuntimeInput {
    Event(notify::Event),
    Watch {
        doc_id: String,
        doc_path: PathBuf,
        resource_paths: Vec<String>,
        reply: mpsc::Sender<Result<(), AppError>>,
    },
    Unwatch {
        doc_id: String,
    },
    Shutdown,
}

/// Production watch runtime: notify watcher + controller thread. Dropping the
/// runtime stops the thread and removes every watch (contracts §7.7).
pub struct WatchRuntime {
    tx: mpsc::Sender<RuntimeInput>,
    join: Option<JoinHandle<()>>,
}

impl fmt::Debug for WatchRuntime {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("WatchRuntime")
            .field("running", &self.join.is_some())
            .finish()
    }
}

impl WatchRuntime {
    /// Starts the runtime. `emitter` receives every flushed `watch-changed`
    /// payload; the command layer forwards it to the Tauri event
    /// `paperstack://watch-changed`.
    pub fn start<F>(config: WatchConfig, emitter: F) -> Result<Self, AppError>
    where
        F: Fn(WatchChangedPayload) + Send + Sync + 'static,
    {
        let (tx, rx) = mpsc::channel::<RuntimeInput>();
        let event_tx = tx.clone();
        let watcher = RecommendedWatcher::new(
            move |result: notify::Result<notify::Event>| {
                if let Ok(event) = result {
                    let _ = event_tx.send(RuntimeInput::Event(event));
                }
            },
            notify::Config::default(),
        )
        .map_err(|error| {
            AppError::new(ErrorCode::Internal)
                .with_message("failed to create the filesystem watcher")
                .with_source(error)
        })?;
        let backend: Box<dyn WatchBackend> = Box::new(NotifyBackend { watcher });
        let mut service = WatchService::with_parts(
            config,
            Box::new(SystemWatchTimer),
            backend,
            Box::new(FsDocPresence),
        );

        let join = thread::spawn(move || loop {
            for payload in service.flush_due() {
                emitter(payload);
            }
            let timeout = service
                .next_flush_delay()
                .map_or(RUNTIME_MAX_WAIT, |delay| delay.min(RUNTIME_MAX_WAIT));
            match rx.recv_timeout(timeout) {
                Ok(RuntimeInput::Event(event)) => service.handle_notify_event(&event),
                Ok(RuntimeInput::Watch {
                    doc_id,
                    doc_path,
                    resource_paths,
                    reply,
                }) => {
                    let result = service.watch_document(&doc_id, &doc_path, &resource_paths);
                    let _ = reply.send(result);
                }
                Ok(RuntimeInput::Unwatch { doc_id }) => service.unwatch_document(&doc_id),
                Ok(RuntimeInput::Shutdown) | Err(mpsc::RecvTimeoutError::Disconnected) => break,
                Err(mpsc::RecvTimeoutError::Timeout) => {}
            }
        });

        Ok(Self {
            tx,
            join: Some(join),
        })
    }

    /// `watch_document` round-trip (contracts §2.1 command 11).
    pub fn watch_document(
        &self,
        doc_id: &str,
        doc_path: &Path,
        resource_paths: &[String],
    ) -> Result<(), AppError> {
        let (reply, reply_rx) = mpsc::channel();
        self.tx
            .send(RuntimeInput::Watch {
                doc_id: doc_id.to_owned(),
                doc_path: doc_path.to_path_buf(),
                resource_paths: resource_paths.to_vec(),
                reply,
            })
            .map_err(runtime_unavailable)?;
        reply_rx
            .recv_timeout(RUNTIME_COMMAND_TIMEOUT)
            .map_err(|_| runtime_unavailable("watch runtime did not answer"))?
    }

    /// `unwatch_document` (contracts §2.1 command 12; no-op success for
    /// unknown documents).
    pub fn unwatch_document(&self, doc_id: &str) -> Result<(), AppError> {
        self.tx
            .send(RuntimeInput::Unwatch {
                doc_id: doc_id.to_owned(),
            })
            .map_err(runtime_unavailable)
    }

    /// Stops the controller thread, dropping all watches and timers.
    pub fn shutdown(mut self) {
        self.stop();
    }

    fn stop(&mut self) {
        if let Some(join) = self.join.take() {
            let _ = self.tx.send(RuntimeInput::Shutdown);
            let _ = join.join();
        }
    }
}

impl Drop for WatchRuntime {
    fn drop(&mut self) {
        self.stop();
    }
}

fn runtime_unavailable(error: impl fmt::Display) -> AppError {
    AppError::new(ErrorCode::Internal).with_message(format!("watch runtime unavailable: {error}"))
}
