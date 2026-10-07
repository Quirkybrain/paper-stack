//! Process-wide managed state (architecture §6): the trusted Rust services
//! share one `AppState` with thread-safe access patterns. Each service owns
//! its own synchronization; commands lock exactly one domain at a time and
//! never hold two locks across unrelated work (deadlock avoidance).
//!
//! Storage degradation (NF08): a failed `Storage::open` never stops the app.
//! The state carries `storage: None`, the services that need it report
//! `PS_STORAGE_UNAVAILABLE`, and authorization/reading keep working from
//! memory.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppError, ErrorCode};
use crate::models::GlobalSettings;
use crate::services::app::{AppService, SecondInstanceDisposition, EVENT_OPEN_REQUESTED};
use crate::services::asset_scope::{AssetScopeController, TauriAssetScope};
use crate::services::auth::AuthRegistry;
use crate::services::diagnostics::{DiagnosticsService, LogCategory, LogEvent, LogField, LogLevel};
use crate::services::files::FilesService;
use crate::services::info::{InfoService, APP_VERSION};
use crate::services::paths::SystemPathProbe;
use crate::services::resources::{RemoteConfig, RemoteService};
use crate::services::storage::Storage;
use crate::services::tree::TreeService;
use crate::services::watch::{WatchConfig, WatchRuntime, EVENT_WATCH_CHANGED};

/// Watch runtime holder; the runtime is started once the Tauri app handle
/// exists and keeps its own controller thread (contracts §7).
#[derive(Debug, Default)]
pub struct WatchState {
    runtime: Option<WatchRuntime>,
}

impl WatchState {
    pub fn runtime(&self) -> Option<&WatchRuntime> {
        self.runtime.as_ref()
    }

    pub fn is_running(&self) -> bool {
        self.runtime.is_some()
    }
}

/// In-memory settings mirror with the last known revision. Initialized from
/// storage (or defaults in the degraded path) and updated by
/// `update_settings` even when persistence fails (R23 `applied`/`persisted`).
#[derive(Debug, Clone, Default)]
pub struct SettingsCache {
    pub global: GlobalSettings,
    pub revision: u64,
}

/// Managed application state (architecture §4/§6).
pub struct AppState {
    pub auth: Mutex<AuthRegistry>,
    pub files: Mutex<FilesService>,
    pub tree: Mutex<TreeService>,
    pub watch: Mutex<WatchState>,
    /// `None` after a storage-open failure (memory-degrade reading, NF08).
    pub storage: Option<Storage>,
    pub remote: Mutex<Option<RemoteService>>,
    pub settings: Mutex<SettingsCache>,
    pub app: Mutex<AppService>,
    /// Runtime asset-protocol scope bridge (wp-14a); shared with the auth
    /// registry and used for remote-cache files.
    pub asset_scope: AssetScopeController,
    pub diagnostics: DiagnosticsService,
    pub info: InfoService,
    pub cache_dir: PathBuf,
}

impl AppState {
    /// Builds the state from the Tauri path resolver. Never fails: storage
    /// degradation is absorbed here and reported through the diagnostics log
    /// (NF08). Startup CLI arguments are queued for
    /// `take_pending_open_requests`.
    pub fn create(app: &AppHandle) -> Self {
        let data_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("paperstack"));
        let cache_dir = app
            .path()
            .app_cache_dir()
            .unwrap_or_else(|_| data_dir.join("cache"));
        let resource_dir = app
            .path()
            .resource_dir()
            .unwrap_or_else(|_| data_dir.join("resources"));
        // Legal texts resolve from the bundled resource dir first; in debug
        // builds the repository root is appended so direct `tauri dev`/`cargo
        // run` executions work before the bundler stages the resources
        // (wp-43 C2; release binaries never read build-machine paths).
        let mut info = InfoService::new(resource_dir);
        if let Some(repo_root) = crate::services::info::dev_repo_root() {
            info = info.with_fallback_dir(repo_root);
        }
        let diagnostics = DiagnosticsService::new(data_dir.join("logs"));

        diagnostics.log(&LogEvent {
            level: LogLevel::Info,
            category: LogCategory::App,
            event: "startup",
            fields: vec![LogField::Text {
                key: "version",
                value: APP_VERSION,
            }],
        });

        let (storage, read_write_error) = Storage::open_with_degrade(&data_dir);
        let mut grants = Vec::new();
        let mut settings = GlobalSettings::default();
        if let Some(storage) = &storage {
            if !storage.is_read_only() {
                // Contract startup step (data-model §3.2): session grants die
                // with the process; persistent rows are revalidated below.
                let _ = storage.purge_session_grants();
            }
            grants = storage.load_grants().unwrap_or_default();
            settings = storage.load_settings().unwrap_or_default();
        }
        if let Some(error) = &read_write_error {
            // The read-write failure is recorded honestly even when the
            // read-only degrade keeps records readable (NF08; data-model
            // §4.5).
            diagnostics.record_app_error(None, error);
            if storage.as_ref().is_some_and(Storage::is_read_only) {
                diagnostics.log(&LogEvent {
                    level: LogLevel::Warn,
                    category: LogCategory::Storage,
                    event: "storage_read_only_degrade",
                    fields: vec![LogField::Text {
                        key: "reason",
                        value: error.code().as_str(),
                    }],
                });
            }
        }

        let mut auth = match &storage {
            Some(storage) => AuthRegistry::with_persistence(Box::new(storage.clone())),
            None => AuthRegistry::new(),
        };
        auth.load_grants(grants);
        let revalidation = auth.revalidate_startup(&SystemPathProbe);
        diagnostics.log(&LogEvent {
            level: LogLevel::Info,
            category: LogCategory::Auth,
            event: "startup_revalidation",
            fields: vec![
                LogField::Number {
                    key: "sessionRemoved",
                    value: revalidation.session_removed as i64,
                },
                LogField::Number {
                    key: "persistentChecked",
                    value: revalidation.persistent_checked as i64,
                },
                LogField::Number {
                    key: "persistentUnavailable",
                    value: revalidation.persistent_unavailable as i64,
                },
            ],
        });

        // Runtime asset-protocol scope (wp-14a; security-model §6). Attached
        // after the startup revalidation: the static scope starts empty and
        // session rows are purged before any in-process allow, so no runtime
        // shrink is due at startup.
        let asset_scope = AssetScopeController::new(Arc::new(TauriAssetScope::new(app.clone())));
        auth.set_runtime_scope(asset_scope.clone());

        let remote = storage.as_ref().and_then(|storage| {
            match RemoteService::with_reqwest(RemoteConfig::default(), storage.clone(), &cache_dir)
            {
                Ok(mut service) => {
                    let _ = service.purge_cross_session_cache();
                    Some(service)
                }
                Err(error) => {
                    diagnostics.record_app_error(None, &error);
                    None
                }
            }
        });

        let mut app_service = AppService::new();
        let args: Vec<String> = std::env::args().collect();
        let cwd = std::env::current_dir()
            .ok()
            .map(|path| path.to_string_lossy().into_owned());
        app_service.queue_startup(&args, cwd.as_deref());

        Self {
            auth: Mutex::new(auth),
            files: Mutex::new(FilesService::new()),
            tree: Mutex::new(TreeService::new()),
            watch: Mutex::new(WatchState::default()),
            storage,
            remote: Mutex::new(remote),
            settings: Mutex::new(SettingsCache {
                global: settings,
                revision: 0,
            }),
            app: Mutex::new(app_service),
            asset_scope,
            diagnostics,
            info,
            cache_dir,
        }
    }

    /// Starts the watch runtime once (idempotent). Event payloads are emitted
    /// as `paperstack://watch-changed` (contracts §4).
    pub fn start_watch(&self, app: &AppHandle) -> Result<(), AppError> {
        let mut watch = self.watch.lock().unwrap_or_else(|error| error.into_inner());
        if watch.runtime.is_some() {
            return Ok(());
        }
        let handle = app.clone();
        let runtime = WatchRuntime::start(WatchConfig::default(), move |payload| {
            let _ = handle.emit(EVENT_WATCH_CHANGED, payload);
        })?;
        watch.runtime = Some(runtime);
        Ok(())
    }
}

/// Single-instance handover (contracts §4): focuses the main window and
/// either queues the request (before the frontend drained the startup queue)
/// or emits `paperstack://open-requested` (`source="second-instance"`).
pub fn handle_second_instance(app: &AppHandle, args: Vec<String>, cwd: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let disposition = state
        .app
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .handle_second_instance(&args, Some(&cwd));
    state.diagnostics.log(&LogEvent {
        level: LogLevel::Info,
        category: LogCategory::App,
        event: "second_instance",
        fields: vec![LogField::Bool {
            key: "delivered",
            value: matches!(disposition, SecondInstanceDisposition::Deliver(_)),
        }],
    });
    if let SecondInstanceDisposition::Deliver(request) = disposition {
        let _ = app.emit(EVENT_OPEN_REQUESTED, request);
    }
}

/// Guarded mutex locking helper used by the command layer; poisoned locks are
/// recovered (a diagnostics/state hiccup must not take the app down).
pub fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|error| error.into_inner())
}

/// Reports an error for storage-dependent commands when the degraded path is
/// active (NF08).
pub fn storage_unavailable() -> AppError {
    AppError::new(ErrorCode::StorageUnavailable)
        .with_message("storage is unavailable; records cannot be read or written")
}
