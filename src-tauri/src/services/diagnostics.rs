//! Diagnostics service: structured local logs with a rolling 10 MiB cap,
//! redaction (never document content, never full private paths, no URL
//! query/fragment tokens), diagnostics bundle construction and preview/export
//! validation (contracts §2 commands 36–37, §3.7; security-model §7; T-18).
//!
//! Design notes:
//!
//! - **Logging** is structured: callers pass a [`LogEvent`] with explicit
//!   fields; there is no free-text API, so document content cannot reach the
//!   log by accident. `Path` and `Url` fields are redacted at write time and
//!   `Text` fields are JSON-escaped.
//! - **Preview bytes are the export bytes** (contracts §2.1): `preview`
//!   renders the bundle once and stores the exact text under a short-lived
//!   `exportId`; `export` only re-validates the target and atomically writes
//!   the stored bytes. A failed export never discards the preview.
//! - **Export validation** follows security-model §7 in order: non-empty
//!   absolute target, unexpired `exportId`, not an open source document, not
//!   inside an open source document's parent directory, explicit overwrite
//!   confirmation, then temp-file + rename.
//! - Redaction helpers are pure and take the home directory as a parameter so
//!   the tests are deterministic without touching the process environment.

use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

use crate::error::{AppError, ErrorCode};
use crate::models::{
    DetailValue, DiagnosticIssue, DiagnosticsAppInfo, DiagnosticsBundle, DiagnosticsDocument,
    DiagnosticsLimits, DiagnosticsPreview, DiagnosticsPreviewRequest, DiagnosticsSection,
    ErrorCategory, ErrorDetails, ExportDiagnosticsRequest, ExportResult,
    DIAGNOSTICS_BUNDLE_VERSION,
};
use crate::services::paths::{is_within_root, lexical_cleanup};

/// Frozen log cap (SRS §6.1; data-model §5 `logMaxBytes`).
pub const LOG_MAX_BYTES: u64 = 10 * 1024 * 1024;
/// Single rolling log file name under `<appDataDir>/logs/`.
pub const LOG_FILE_NAME: &str = "paperstack.log";
/// Truncation marker written when the cap forces the oldest bytes out.
pub const TRUNCATION_MARKER: &str = "# -- paperstack log truncated (10 MiB cap) --";
/// Preview lifetime (calibratable; contracts only require a TTL and a small
/// in-memory cap). Tests freeze it through the injectable clock.
pub const PREVIEW_TTL_MS: i64 = 15 * 60 * 1000;
/// Small in-memory preview cap (contracts §2.1).
pub const MAX_PREVIEWS: usize = 8;
/// Bundle document section cap (defensive; the UI opens far fewer documents).
pub const MAX_DOCUMENTS: usize = 200;
/// Per-document issue aggregation cap.
pub const MAX_ISSUES_PER_DOCUMENT: usize = 50;
/// `DiagnosticsLimits.largeFileBytes`: simplified-reading threshold
/// (data-model §5).
pub const LARGE_FILE_BYTES: u64 = 10 * 1024 * 1024;

/// Whitelist of `ErrorPayload.details` keys that may appear in logs/bundles
/// (security-model §7: "details 只允许白名单键"). Keys outside this list are
/// dropped with a redaction note.
pub const DETAIL_KEY_ALLOWLIST: [&str; 7] = [
    "rootCandidate",
    "scheme",
    "newOrigin",
    "operation",
    "failures",
    "degraded",
    "reason",
];

// ---------------------------------------------------------------------------
// Clock seam
// ---------------------------------------------------------------------------

/// Clock seam for preview TTLs and log timestamps (production:
/// [`SystemDiagnosticsClock`]; tests: [`ManualDiagnosticsClock`]).
pub trait DiagnosticsClock: Send + Sync + std::fmt::Debug {
    fn now_ms(&self) -> i64;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemDiagnosticsClock;

impl DiagnosticsClock for SystemDiagnosticsClock {
    fn now_ms(&self) -> i64 {
        match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(duration) => i64::try_from(duration.as_millis()).unwrap_or(i64::MAX),
            Err(_) => 0,
        }
    }
}

/// Manually advanced clock for deterministic tests.
#[derive(Debug, Default, Clone)]
pub struct ManualDiagnosticsClock {
    now_ms: Arc<AtomicI64>,
}

impl ManualDiagnosticsClock {
    pub fn new(start_ms: i64) -> Self {
        Self {
            now_ms: Arc::new(AtomicI64::new(start_ms)),
        }
    }

    pub fn set(&self, now_ms: i64) {
        self.now_ms.store(now_ms, Ordering::SeqCst);
    }

    pub fn advance(&self, delta_ms: i64) {
        self.now_ms.fetch_add(delta_ms, Ordering::SeqCst);
    }
}

impl DiagnosticsClock for ManualDiagnosticsClock {
    fn now_ms(&self) -> i64 {
        self.now_ms.load(Ordering::SeqCst)
    }
}

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub const fn as_str(self) -> &'static str {
        match self {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }
}

/// Log categories (the diagnostics taxonomy mirrors `ErrorCategory` plus the
/// service-level `command`/`watch`/`diagnostics`/`app` groups).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogCategory {
    Command,
    Io,
    Encoding,
    Auth,
    Resource,
    Parse,
    Storage,
    Limit,
    Watch,
    Diagnostics,
    App,
}

impl LogCategory {
    pub const fn as_str(self) -> &'static str {
        match self {
            LogCategory::Command => "command",
            LogCategory::Io => "io",
            LogCategory::Encoding => "encoding",
            LogCategory::Auth => "auth",
            LogCategory::Resource => "resource",
            LogCategory::Parse => "parse",
            LogCategory::Storage => "storage",
            LogCategory::Limit => "limit",
            LogCategory::Watch => "watch",
            LogCategory::Diagnostics => "diagnostics",
            LogCategory::App => "app",
        }
    }
}

impl From<ErrorCategory> for LogCategory {
    fn from(category: ErrorCategory) -> Self {
        match category {
            ErrorCategory::Io => LogCategory::Io,
            ErrorCategory::Encoding => LogCategory::Encoding,
            ErrorCategory::Auth => LogCategory::Auth,
            ErrorCategory::Resource => LogCategory::Resource,
            ErrorCategory::Parse => LogCategory::Parse,
            ErrorCategory::Storage => LogCategory::Storage,
            ErrorCategory::Limit => LogCategory::Limit,
            ErrorCategory::Internal => LogCategory::App,
        }
    }
}

/// One structured log field. `Path`/`Url` values are redacted by variant;
/// `Text` values are trusted internal tokens (codes, i18n keys, ids).
#[derive(Debug)]
pub enum LogField<'a> {
    Text { key: &'a str, value: &'a str },
    Path { key: &'a str, value: &'a str },
    Url { key: &'a str, value: &'a str },
    Number { key: &'a str, value: i64 },
    Bool { key: &'a str, value: bool },
}

impl LogField<'_> {
    fn render(&self) -> String {
        match self {
            LogField::Text { key, value } => format!("{key}={}", json_token(value)),
            LogField::Path { key, value } => {
                format!("{key}={}", json_token(&redact_path(value)))
            }
            LogField::Url { key, value } => format!("{key}={}", json_token(&redact_url(value))),
            LogField::Number { key, value } => format!("{key}={value}"),
            LogField::Bool { key, value } => format!("{key}={value}"),
        }
    }
}

/// One structured log entry (no free-text body).
#[derive(Debug)]
pub struct LogEvent<'a> {
    pub level: LogLevel,
    pub category: LogCategory,
    pub event: &'a str,
    pub fields: Vec<LogField<'a>>,
}

impl LogEvent<'_> {
    /// Deterministic single-line rendering. `event` names are normalized so
    /// they can never break the line format.
    pub fn render(&self, now_ms: i64) -> String {
        let event: String = self
            .event
            .chars()
            .map(|c| if c.is_whitespace() { '_' } else { c })
            .collect();
        let mut line = format!(
            "ts={now_ms} level={} category={} event={event}",
            self.level.as_str(),
            self.category.as_str()
        );
        for field in &self.fields {
            line.push(' ');
            line.push_str(&field.render());
        }
        line
    }
}

fn json_token(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"<unprintable>\"".to_owned())
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

/// Redacts one path for logs/bundles (security-model §7): the home directory
/// becomes `~`, the middle directories become `<dir>` and the last two path
/// levels are kept. Relative paths are not full private paths and pass
/// through unchanged. A NUL byte truncates the value.
pub fn redact_path(raw: &str) -> String {
    redact_path_with_home(raw, home_dir().as_deref())
}

/// Testable [`redact_path`] with an explicit home directory.
pub fn redact_path_with_home(raw: &str, home: Option<&Path>) -> String {
    let value = raw.split('\0').next().unwrap_or("");
    if value.is_empty() {
        return String::new();
    }
    let path = Path::new(value);
    if !path.is_absolute() {
        return value.to_owned();
    }
    let components = normal_components(path);
    let at_home = home.is_some_and(|home| path.starts_with(home));
    let visible: &[String] = if at_home {
        let home_depth = home.map(normal_components).map_or(0, |home| home.len());
        components.get(home_depth..).unwrap_or(&[])
    } else {
        &components
    };
    if visible.is_empty() {
        return if at_home {
            "~".to_owned()
        } else {
            "/".to_owned()
        };
    }
    let tail = if visible.len() <= 2 {
        visible.join("/")
    } else {
        format!("<dir>/{}", visible[visible.len() - 2..].join("/"))
    };
    if at_home {
        format!("~/{tail}")
    } else {
        format!("/{tail}")
    }
}

fn normal_components(path: &Path) -> Vec<String> {
    path.components()
        .filter_map(|component| match component {
            std::path::Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            std::path::Component::ParentDir => Some("..".to_owned()),
            _ => None,
        })
        .collect()
}

/// Redacts one URL for logs/bundles: only `scheme://host[:port]` is kept, so
/// query strings, fragments and any embedded token/user-info never reach the
/// log. Values that do not parse as URLs are stripped at `?`/`#` and at any
/// `@` user-info separator.
pub fn redact_url(raw: &str) -> String {
    let value = raw.split('\0').next().unwrap_or("");
    if value.is_empty() {
        return String::new();
    }
    if let Ok(url) = url::Url::parse(value) {
        if let Some(host) = url.host_str() {
            return match url.port() {
                Some(port) => format!("{}://{host}:{port}", url.scheme()),
                None => format!("{}://{host}", url.scheme()),
            };
        }
    }
    fallback_url_strip(value)
}

fn fallback_url_strip(value: &str) -> String {
    let without_fragment = value.split('#').next().unwrap_or("");
    let without_query = without_fragment.split('?').next().unwrap_or("");
    match without_query.rsplit_once('@') {
        Some((_, host)) => host.to_owned(),
        None => without_query.to_owned(),
    }
}

/// Details with non-allowlisted keys dropped (security-model §7).
pub fn sanitize_details(details: &ErrorDetails) -> ErrorDetails {
    details
        .iter()
        .filter(|(key, _)| DETAIL_KEY_ALLOWLIST.contains(&key.as_str()))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect()
}

// ---------------------------------------------------------------------------
// Rolling log file
// ---------------------------------------------------------------------------

/// Single-file rolling log. When an append would exceed `max_bytes`, the
/// oldest bytes are dropped at a line/UTF-8 boundary and the append continues
/// with a truncation marker; `total_bytes()` therefore never exceeds the cap.
#[derive(Debug)]
struct LogFile {
    path: PathBuf,
    max_bytes: u64,
    write_lock: Mutex<()>,
    dropped: AtomicU64,
}

impl LogFile {
    fn new(path: PathBuf, max_bytes: u64) -> Self {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        Self {
            path,
            max_bytes,
            write_lock: Mutex::new(()),
            dropped: AtomicU64::new(0),
        }
    }

    fn append(&self, line: &str) -> io::Result<()> {
        if line.is_empty() {
            return Ok(());
        }
        let _guard = self
            .write_lock
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut record = String::with_capacity(line.len() + 1);
        record.push_str(line);
        record.push('\n');
        let bytes = record.as_bytes();

        let current = fs::metadata(&self.path).map(|meta| meta.len()).unwrap_or(0);
        if current + bytes.len() as u64 <= self.max_bytes {
            let mut file = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.path)?;
            file.write_all(bytes)?;
            return Ok(());
        }

        let mut marker = String::from(TRUNCATION_MARKER);
        marker.push('\n');
        let budget = self
            .max_bytes
            .saturating_sub(marker.len() as u64)
            .saturating_sub(bytes.len() as u64);
        if budget == 0 {
            self.dropped.fetch_add(1, Ordering::SeqCst);
            return Ok(());
        }
        let old = fs::read(&self.path).unwrap_or_default();
        let keep = usize::try_from(budget).unwrap_or(usize::MAX).min(old.len());
        let mut start = old.len() - keep;
        // Start at the next line boundary...
        while start < old.len() && old[start] != b'\n' {
            start += 1;
        }
        if start < old.len() {
            start += 1;
        }
        // ... and at the next UTF-8 character boundary.
        while start < old.len() && std::str::from_utf8(&old[start..]).is_err() {
            start += 1;
        }
        let mut file = File::create(&self.path)?;
        file.write_all(marker.as_bytes())?;
        file.write_all(&old[start..])?;
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok(())
    }

    fn total_bytes(&self) -> u64 {
        fs::metadata(&self.path).map(|meta| meta.len()).unwrap_or(0)
    }

    fn remove(&self) -> io::Result<bool> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(true),
            Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
            Err(error) => Err(error),
        }
    }
}

// ---------------------------------------------------------------------------
// Protected export sources
// ---------------------------------------------------------------------------

/// Canonical source locations protected from diagnostics export
/// (security-model §7 steps 2–3): every open document file and every open
/// document's canonical parent directory.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProtectedSources {
    entries: Vec<(PathBuf, PathBuf)>,
}

impl ProtectedSources {
    pub fn from_paths<I: IntoIterator<Item = String>>(paths: I) -> Self {
        let mut entries = Vec::new();
        let mut seen = BTreeSet::new();
        for raw in paths {
            if !seen.insert(raw.clone()) {
                continue;
            }
            let file = PathBuf::from(raw);
            let Some(parent) = file.parent().map(Path::to_path_buf) else {
                continue;
            };
            entries.push((file, parent));
        }
        Self { entries }
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// `true` when `target` is an open source document or lies inside an open
    /// source document's canonical parent directory (component-level).
    pub fn blocks(&self, target: &Path) -> bool {
        self.entries
            .iter()
            .any(|(file, parent)| file == target || is_within_root(parent, target))
    }
}

// ---------------------------------------------------------------------------
// Diagnostics service
// ---------------------------------------------------------------------------

/// One document row of the preview request, supplied by the command layer
/// from the registered document set (metadata only, never content).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentDiagnosticsInput {
    pub doc_id: String,
    pub display_name: String,
    pub canonical_path: Option<String>,
    pub version_hash: String,
    pub status: String,
}

/// Bundle plus the number of redaction operations applied while building it
/// (`DiagnosticsPreview.redactionCount`; the wire bundle has no such field).
#[derive(Debug)]
pub struct BuiltBundle {
    pub bundle: DiagnosticsBundle,
    pub redaction_count: u64,
}

/// Rendered preview text with its section size report.
#[derive(Debug)]
pub struct RenderedBundle {
    pub text: String,
    pub sections: Vec<DiagnosticsSection>,
    pub redaction_count: u64,
}

#[derive(Debug, Clone)]
struct StoredPreview {
    export_id: String,
    expires_at_ms: i64,
    text: String,
}

/// Diagnostics service (thread-safe: log writes and preview/issue maps carry
/// their own locks; methods take `&self`).
#[derive(Debug)]
pub struct DiagnosticsService {
    log: LogFile,
    issues: Mutex<BTreeMap<String, Vec<DiagnosticIssue>>>,
    previews: Mutex<VecDeque<StoredPreview>>,
    clock: Box<dyn DiagnosticsClock>,
    sequence: AtomicU64,
}

impl DiagnosticsService {
    pub fn new(logs_dir: impl AsRef<Path>) -> Self {
        Self::with_config(logs_dir, LOG_MAX_BYTES, Box::new(SystemDiagnosticsClock))
    }

    pub fn with_config(
        logs_dir: impl AsRef<Path>,
        max_bytes: u64,
        clock: Box<dyn DiagnosticsClock>,
    ) -> Self {
        Self {
            log: LogFile::new(logs_dir.as_ref().join(LOG_FILE_NAME), max_bytes),
            issues: Mutex::new(BTreeMap::new()),
            previews: Mutex::new(VecDeque::new()),
            clock,
            sequence: AtomicU64::new(0),
        }
    }

    /// Appends one structured line; logging failures are swallowed by design
    /// (diagnostics must never break a command).
    pub fn log(&self, event: &LogEvent<'_>) {
        let line = event.render(self.clock.now_ms());
        let _ = self.log.append(&line);
    }

    /// Records a command failure: one structured log line (stable code,
    /// category, i18n key, source range, retry/recovery flag) plus, for
    /// document-scoped failures, an aggregated diagnostic issue
    /// (contracts §3.7 `DiagnosticIssue`).
    pub fn record_app_error(&self, doc_id: Option<&str>, error: &AppError) {
        let mut fields = vec![
            LogField::Text {
                key: "code",
                value: error.code().as_str(),
            },
            LogField::Text {
                key: "messageKey",
                value: error.message_key(),
            },
            LogField::Bool {
                key: "retryable",
                value: error.retryable(),
            },
        ];
        if let Some(range) = error.source_range() {
            fields.push(LogField::Number {
                key: "sourceStartByte",
                value: i64::try_from(range.start_byte).unwrap_or(i64::MAX),
            });
            fields.push(LogField::Number {
                key: "sourceEndByte",
                value: i64::try_from(range.end_byte).unwrap_or(i64::MAX),
            });
        }
        self.log(&LogEvent {
            level: LogLevel::Warn,
            category: error.category().into(),
            event: "command_failed",
            fields,
        });
        if let Some(doc_id) = doc_id {
            if error.code() != ErrorCode::TaskCancelled {
                self.record_issue(doc_id, error);
            }
        }
    }

    /// Aggregates one issue per `(code, messageKey, sourceRange)` and caps the
    /// per-document list.
    pub fn record_issue(&self, doc_id: &str, error: &AppError) {
        let mut issues = self
            .issues
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let entries = issues.entry(doc_id.to_owned()).or_default();
        if let Some(entry) = entries.iter_mut().find(|entry| {
            entry.code == error.code().as_str()
                && entry.message_key == error.message_key()
                && entry.source_range == error.source_range()
        }) {
            entry.count = entry.count.saturating_add(1);
            return;
        }
        if entries.len() >= MAX_ISSUES_PER_DOCUMENT {
            return;
        }
        entries.push(DiagnosticIssue {
            code: error.code().as_str().to_owned(),
            category: error.category(),
            message_key: error.message_key().to_owned(),
            source_range: error.source_range(),
            count: 1,
            first_seen_at_ms: self.clock.now_ms(),
        });
    }

    pub fn issues_for(&self, doc_id: &str) -> Vec<DiagnosticIssue> {
        self.issues
            .lock()
            .unwrap_or_else(|error| error.into_inner())
            .get(doc_id)
            .cloned()
            .unwrap_or_default()
    }

    /// `(file count, bytes)` for `get_storage_overview`'s `logs` category.
    pub fn log_usage(&self) -> (u64, u64) {
        let bytes = self.log.total_bytes();
        let files = u64::from(bytes > 0);
        (files, bytes)
    }

    /// Number of log lines dropped because a single entry could not fit the
    /// cap (counter for tests/diagnostics).
    pub fn dropped_log_lines(&self) -> u64 {
        self.log.dropped.load(Ordering::SeqCst)
    }

    /// Removes the rolling log file; returns the removed file count.
    pub fn clear_logs(&self) -> Result<u64, AppError> {
        self.log
            .remove()
            .map(u64::from)
            .map_err(AppError::from_io_write)
    }

    /// Builds the redacted bundle (contracts §3.7). `include_source_context`
    /// keeps issue `sourceRange` values; `include_full_paths` keeps full
    /// document paths/names. Both default to `false` and are only set by the
    /// user's explicit preview checkboxes (R28).
    pub fn build_bundle(
        &self,
        app: DiagnosticsAppInfo,
        documents: &[DocumentDiagnosticsInput],
        limits: DiagnosticsLimits,
        include_source_context: bool,
        include_full_paths: bool,
    ) -> BuiltBundle {
        let mut redaction_count = 0u64;
        let stored = self
            .issues
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut rows = Vec::new();
        for input in documents.iter().take(MAX_DOCUMENTS) {
            let mut issues = stored.get(&input.doc_id).cloned().unwrap_or_default();
            issues.truncate(MAX_ISSUES_PER_DOCUMENT);
            if !include_source_context {
                for issue in &mut issues {
                    if issue.source_range.take().is_some() {
                        redaction_count = redaction_count.saturating_add(1);
                    }
                }
            }
            let (name, name_redacted) =
                redact_display_name(&input.display_name, include_full_paths);
            if name_redacted {
                redaction_count = redaction_count.saturating_add(1);
            }
            rows.push(DiagnosticsDocument {
                doc_id_short: input.doc_id.clone(),
                display_name_redacted: name,
                version_hash: input.version_hash.clone(),
                status: input.status.clone(),
                issues,
            });
        }
        let redactions = redaction_notes(include_source_context, include_full_paths);
        BuiltBundle {
            bundle: DiagnosticsBundle {
                bundle_version: DIAGNOSTICS_BUNDLE_VERSION,
                generated_at_ms: self.clock.now_ms(),
                app,
                documents: rows,
                limits,
                redactions,
            },
            redaction_count,
        }
    }

    /// Deterministic plain-text rendering; preview bytes equal export bytes
    /// (contracts §2.1).
    pub fn render_bundle(&self, built: &BuiltBundle) -> RenderedBundle {
        let bundle = &built.bundle;
        let mut app_section = String::new();
        app_section.push_str("paperstack-diagnostics version=");
        app_section.push_str(&bundle.bundle_version.to_string());
        app_section.push('\n');
        app_section.push_str(&format!("generatedAtMs={}\n", bundle.generated_at_ms));
        app_section.push_str(&format!(
            "app name={} version={} ipcContract={}",
            bundle.app.name, bundle.app.version, bundle.app.ipc_contract
        ));
        for (key, value) in [
            ("tauriVersion", &bundle.app.tauri_version),
            ("webkitVersion", &bundle.app.webkit_version),
            ("os", &bundle.app.os),
        ] {
            if let Some(value) = value {
                app_section.push_str(&format!(" {key}={value}"));
            }
        }
        app_section.push('\n');

        let mut documents_section = format!("documents count={}\n", bundle.documents.len());
        for document in &bundle.documents {
            documents_section.push_str(&format!(
                "doc id={} name={} version={} status={} issues={}\n",
                document.doc_id_short,
                document.display_name_redacted,
                document.version_hash,
                document.status,
                document.issues.len()
            ));
            for issue in &document.issues {
                documents_section.push_str(&format!(
                    "issue code={} category={} key={} count={} firstSeenAtMs={}",
                    issue.code,
                    category_str(issue.category),
                    issue.message_key,
                    issue.count,
                    issue.first_seen_at_ms
                ));
                if let Some(range) = issue.source_range {
                    documents_section.push_str(&format!(
                        " sourceRange=[{},{})",
                        range.start_byte, range.end_byte
                    ));
                }
                documents_section.push('\n');
            }
        }

        let limits = &bundle.limits;
        let limits_section = format!(
            "limits recentLimit={} cacheMaxBytes={} logMaxBytes={} largeFileBytes={} hardLimitBytes={} imageBytes={}\n",
            limits.frozen.recent_limit,
            limits.frozen.cache_max_bytes,
            limits.frozen.log_max_bytes,
            limits.large_file_bytes,
            limits.hard_limit_bytes,
            limits.image_bytes
        );
        let redactions_section = format!("redactions {}\n", bundle.redactions.join(", "));

        let mut text = String::with_capacity(
            app_section.len()
                + documents_section.len()
                + limits_section.len()
                + redactions_section.len(),
        );
        text.push_str(&app_section);
        text.push_str(&documents_section);
        text.push_str(&limits_section);
        text.push_str(&redactions_section);
        let sections = vec![
            DiagnosticsSection {
                name: "app".to_owned(),
                bytes: app_section.len() as u64,
            },
            DiagnosticsSection {
                name: "documents".to_owned(),
                bytes: documents_section.len() as u64,
            },
            DiagnosticsSection {
                name: "limits".to_owned(),
                bytes: limits_section.len() as u64,
            },
            DiagnosticsSection {
                name: "redactions".to_owned(),
                bytes: redactions_section.len() as u64,
            },
        ];
        RenderedBundle {
            text,
            sections,
            redaction_count: built.redaction_count,
        }
    }

    /// Generates a preview and stores the exact bytes under a fresh
    /// `exportId` (contracts §2.1 command 36).
    pub fn preview(
        &self,
        request: &DiagnosticsPreviewRequest,
        app: DiagnosticsAppInfo,
        documents: &[DocumentDiagnosticsInput],
        limits: DiagnosticsLimits,
    ) -> DiagnosticsPreview {
        let built = self.build_bundle(
            app,
            documents,
            limits,
            request.include_source_context,
            request.include_full_paths,
        );
        let rendered = self.render_bundle(&built);
        let generated_at_ms = built.bundle.generated_at_ms;
        let expires_at_ms = generated_at_ms.saturating_add(PREVIEW_TTL_MS);
        let sequence = self.sequence.fetch_add(1, Ordering::SeqCst);
        let export_id = export_id_for(generated_at_ms, sequence, &rendered.text);
        let mut previews = self
            .previews
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        previews.retain(|preview| preview.expires_at_ms > generated_at_ms);
        while previews.len() >= MAX_PREVIEWS {
            previews.pop_front();
        }
        previews.push_back(StoredPreview {
            export_id: export_id.clone(),
            expires_at_ms,
            text: rendered.text.clone(),
        });
        DiagnosticsPreview {
            export_id,
            generated_at_ms,
            text: rendered.text,
            sections: rendered.sections,
            redaction_count: rendered.redaction_count,
            expires_at_ms,
        }
    }

    /// Compact copy-to-clipboard summary (contracts §3.7 `diagnostics.
    /// copySummary`; security-model §7): paths and source ranges are excluded
    /// unless the user explicitly selected the corresponding preview option.
    pub fn copy_summary(
        &self,
        app: &DiagnosticsAppInfo,
        documents: &[DocumentDiagnosticsInput],
        include_source_context: bool,
        include_full_paths: bool,
    ) -> String {
        let stored = self
            .issues
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let mut text = format!("{} {} — diagnostics summary\n", app.name, app.version);
        text.push_str(&format!("documents: {}\n", documents.len()));
        for input in documents.iter().take(MAX_DOCUMENTS) {
            let issues = stored.get(&input.doc_id).cloned().unwrap_or_default();
            let (name, _) = redact_display_name(&input.display_name, include_full_paths);
            text.push_str(&format!(
                "- {name} ({}): {} issue(s)\n",
                input.status,
                issues.len()
            ));
            for issue in issues.iter().take(MAX_ISSUES_PER_DOCUMENT) {
                text.push_str(&format!(
                    "  {} x{} ({})",
                    issue.code, issue.count, issue.message_key
                ));
                if include_source_context {
                    if let Some(range) = issue.source_range {
                        text.push_str(&format!(
                            " sourceRange=[{},{})",
                            range.start_byte, range.end_byte
                        ));
                    }
                }
                text.push('\n');
            }
            if include_full_paths {
                if let Some(path) = &input.canonical_path {
                    text.push_str(&format!("  path: {path}\n"));
                }
            }
        }
        text
    }

    /// `export_diagnostics` (contract command 37; security-model §7):
    /// validates the stored preview, the protected-source rules and the
    /// overwrite confirmation, then writes the preview bytes atomically.
    /// A failed export leaves the preview stored for copying/retry.
    pub fn export(
        &self,
        request: &ExportDiagnosticsRequest,
        protected: &ProtectedSources,
    ) -> Result<ExportResult, AppError> {
        let now = self.clock.now_ms();
        let text = {
            let mut previews = self
                .previews
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            previews.retain(|preview| preview.expires_at_ms > now);
            let Some(preview) = previews
                .iter()
                .find(|preview| preview.export_id == request.export_id)
            else {
                return Err(AppError::new(ErrorCode::IoNotFound)
                    .with_message("diagnostics exportId is unknown or expired"));
            };
            preview.text.clone()
        };

        let target = resolve_export_target(&request.target_path)?;
        if protected.blocks(&target) {
            return Err(export_blocked(
                "export target is an open source document or inside a protected source directory",
                "protected-source",
            ));
        }
        if fs::symlink_metadata(&target).is_ok() && !request.overwrite {
            return Err(export_blocked(
                "export target exists; explicit overwrite confirmation is required",
                "target-exists",
            ));
        }
        atomic_write_file(&target, text.as_bytes()).map_err(|error| {
            AppError::from_io_write(error).with_message("diagnostics export failed")
        })?;
        Ok(ExportResult {
            written_path: target.to_string_lossy().into_owned(),
            bytes: text.len() as u64,
        })
    }
}

fn export_id_for(generated_at_ms: i64, sequence: u64, text: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(generated_at_ms.to_be_bytes());
    hasher.update(sequence.to_be_bytes());
    hasher.update(text.as_bytes());
    let mut encoded = hex::encode(hasher.finalize());
    encoded.truncate(16);
    format!("x-{encoded}")
}

/// Keeps a single filename segment (drops any directory prefix); with
/// `include_full_paths` the display name is returned unchanged. Returns
/// `(name, was_collapsed)`.
fn redact_display_name(name: &str, include_full_paths: bool) -> (String, bool) {
    if include_full_paths {
        return (name.to_owned(), false);
    }
    if name.contains('\0') {
        return (String::new(), true);
    }
    match name.rsplit(['/', '\\']).next() {
        Some(base) if base.len() != name.len() => (base.to_owned(), true),
        _ => (name.to_owned(), false),
    }
}

fn category_str(category: ErrorCategory) -> &'static str {
    match category {
        ErrorCategory::Io => "io",
        ErrorCategory::Encoding => "encoding",
        ErrorCategory::Auth => "auth",
        ErrorCategory::Resource => "resource",
        ErrorCategory::Parse => "parse",
        ErrorCategory::Storage => "storage",
        ErrorCategory::Limit => "limit",
        ErrorCategory::Internal => "internal",
    }
}

fn redaction_notes(include_source_context: bool, include_full_paths: bool) -> Vec<String> {
    let mut notes = vec!["document-text".to_owned(), "details-allowlist".to_owned()];
    if !include_full_paths {
        notes.push("home-directory".to_owned());
        notes.push("absolute-paths-last-two".to_owned());
    }
    notes.push("url-query-fragment".to_owned());
    if !include_source_context {
        notes.push("source-context".to_owned());
    }
    notes
}

/// `PS_IO_EXPORT_BLOCKED` with a machine-readable `reason` detail so the UI
/// can distinguish a protected source target from an existing-file overwrite
/// question (security-model §7; D-34b-3/AT28). The value is a fixed enum
/// string, never a path or user text.
fn export_blocked(message: &str, reason: &str) -> AppError {
    AppError::new(ErrorCode::IoExportBlocked)
        .with_message(message)
        .with_details(ErrorDetails::from([(
            "reason".to_owned(),
            DetailValue::String(reason.to_owned()),
        )]))
}

/// Absolute, lexically cleaned target with the nearest existing ancestor
/// canonicalized (so symlinked parents cannot disguise protected locations).
fn resolve_export_target(raw: &str) -> Result<PathBuf, AppError> {
    let trimmed = raw.trim();
    let path = Path::new(trimmed);
    if trimmed.is_empty() || !path.is_absolute() {
        return Err(export_blocked(
            "export target must be a non-empty absolute path",
            "invalid-target",
        ));
    }
    canonicalize_best_effort(&lexical_cleanup(path)).map_err(|error| {
        AppError::from_io_write(error).with_message("export target is not writable")
    })
}

fn canonicalize_best_effort(path: &Path) -> io::Result<PathBuf> {
    let mut current = path.to_path_buf();
    let mut suffix: Vec<std::ffi::OsString> = Vec::new();
    loop {
        match fs::canonicalize(&current) {
            Ok(mut canonical) => {
                for part in suffix.iter().rev() {
                    canonical.push(part);
                }
                return Ok(canonical);
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                match (current.file_name(), current.parent()) {
                    (Some(name), Some(parent)) if parent != current => {
                        suffix.push(name.to_os_string());
                        current = parent.to_path_buf();
                    }
                    _ => return Err(error),
                }
            }
            Err(error) => return Err(error),
        }
    }
}

/// Temp file in the target directory + rename; used for diagnostics export.
/// The temp file is removed on failure (security-model §7 step 5).
pub fn atomic_write_file(target: &Path, bytes: &[u8]) -> io::Result<()> {
    static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let parent = target
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let name = target
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "paperstack-export".to_owned());
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::SeqCst);
    let temp = parent.join(format!(
        ".{name}.{}.{sequence}.paperstack.tmp",
        std::process::id()
    ));
    let write_result = (|| -> io::Result<()> {
        let mut file = File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok(())
    })();
    if let Err(error) = write_result {
        let _ = fs::remove_file(&temp);
        return Err(error);
    }
    match fs::rename(&temp, target) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temp);
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_redaction_keeps_home_marker_and_last_two_levels() {
        let home = Path::new("/home/u");
        assert_eq!(
            redact_path_with_home("/home/u/notes/paper/guide.md", Some(home)),
            "~/<dir>/paper/guide.md"
        );
        assert_eq!(
            redact_path_with_home("/home/u/guide.md", Some(home)),
            "~/guide.md"
        );
        assert_eq!(
            redact_path_with_home("/var/lib/paperstack/logs/x.log", Some(home)),
            "/<dir>/logs/x.log"
        );
        assert_eq!(
            redact_path_with_home("notes/local.md", Some(home)),
            "notes/local.md"
        );
        assert_eq!(redact_path_with_home("", Some(home)), "");
    }

    #[test]
    fn url_redaction_drops_query_fragment_and_userinfo() {
        assert_eq!(
            redact_url("https://example.com/img/a.png?token=s3cret#frag"),
            "https://example.com"
        );
        assert_eq!(
            redact_url("https://cdn.example.com:8443/a.png?x=1"),
            "https://cdn.example.com:8443"
        );
        assert_eq!(
            redact_url("https://user:pass@example.com/a?token=1"),
            "https://example.com"
        );
        assert_eq!(redact_url("not a url?q=1"), "not a url");
    }

    #[test]
    fn details_sanitizer_drops_unknown_keys() {
        let mut details = ErrorDetails::new();
        details.insert(
            "rootCandidate".to_owned(),
            crate::models::DetailValue::String("/tmp/x".to_owned()),
        );
        details.insert(
            "reason".to_owned(),
            crate::models::DetailValue::String("protected-source".to_owned()),
        );
        details.insert(
            "secretToken".to_owned(),
            crate::models::DetailValue::String("abc".to_owned()),
        );
        let sanitized = sanitize_details(&details);
        assert!(sanitized.contains_key("rootCandidate"));
        assert!(sanitized.contains_key("reason"));
        assert!(!sanitized.contains_key("secretToken"));
    }
}
