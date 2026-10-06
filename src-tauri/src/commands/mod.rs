//! IPC command layer (contracts §2; architecture §2.3): thin adapters that
//! validate parameters, call exactly one service path, map `AppError` to the
//! wire `ErrorPayload` and emit events where the contracts specify. No
//! business logic lives here beyond that mapping/orchestration.
//!
//! The [`command_surface!`] invocation below is the single source of truth:
//! it generates both the `tauri::generate_handler!` registration and the
//! [`COMMANDS`] table asserted against `fixtures/contracts/commands.json` by
//! `tests/commands_surface.rs`, so registration and surface cannot drift.
//!
//! Argument convention (for the wp-16 TS wrappers): every command whose
//! contracts §2 request is a §3 model takes a single `req` argument carrying
//! that model; scalar requests (`docId`, `grantId`, `url`, `path`, `kind`)
//! arrive as the named scalar. `resume_recording` accepts an optional `req`.

pub mod app;
pub mod auth;
pub mod diagnostics;
pub mod files;
pub mod resources;
pub mod storage;
pub mod tree;
pub mod watch;

use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::error::{AppError, ErrorCode};
use crate::models::{DiagnosticsAppInfo, ErrorPayload};
use crate::services::info::InfoService;
use crate::state::AppState;

/// One row of the maintained IPC surface table (contracts §2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CommandSpec {
    /// Rust command name (snake_case).
    pub name: &'static str,
    /// Command module that owns the adapter.
    pub module: &'static str,
    /// Contracts §2 row number (1-based).
    pub contract_row: u8,
    /// Request shape (contracts §2/§3 model or inline scalar).
    pub request: &'static str,
    /// Response shape.
    pub response: &'static str,
}

macro_rules! command_surface {
    ($( $name:ident : $path:path, $row:literal, $module:literal, $request:literal, $response:literal; )+) => {
        /// The complete `paperstack-ipc-r1` command surface (contracts §2), in
        /// contract row order.
        pub const COMMANDS: [CommandSpec; 38] = [
            $(
                CommandSpec {
                    name: stringify!($name),
                    module: $module,
                    contract_row: $row,
                    request: $request,
                    response: $response,
                },
            )+
        ];

        /// Tauri invoke handler for the whole surface. Generated from the same
        /// list as [`COMMANDS`], so a name in the table is always registered.
        /// The desktop runtime is pinned to `tauri::Wry` (the `tauri::Builder`
        /// default).
        pub fn invoke_handler(
        ) -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static {
            tauri::generate_handler![$( $path ),+]
        }
    };
}

command_surface![
    pick_files: files::pick_files, 1, "files", "()", "PickResult";
    pick_directory: files::pick_directory, 2, "files", "()", "PickResult";
    pick_export_target: files::pick_export_target, 3, "files", "()", "PickResult";
    open_documents: files::open_documents, 4, "files", "OpenDocumentsRequest", "OpenDocumentsResult";
    read_document: files::read_document, 5, "files", "ReadDocumentRequest", "DocumentSnapshot";
    relink_document: files::relink_document, 6, "files", "RelinkRequest", "RelinkResult";
    get_source_info: files::get_source_info, 7, "files", "DocId", "SourceInfo";
    read_source_window: files::read_source_window, 8, "files", "ReadSourceWindowRequest", "SourceWindow";
    open_directory: tree::open_directory, 9, "tree", "OpenDirectoryRequest", "DirectoryRoot";
    read_directory: tree::read_directory, 10, "tree", "ReadDirectoryRequest", "DirectoryListing";
    watch_document: watch::watch_document, 11, "watch", "WatchRequest", "{}";
    unwatch_document: watch::unwatch_document, 12, "watch", "DocId", "{}";
    list_recents: storage::list_recents, 13, "storage", "()", "RecentEntry[]";
    touch_recent: storage::touch_recent, 14, "storage", "DocId", "{}";
    save_position: storage::save_position, 15, "storage", "SavePositionRequest", "SaveResult";
    load_position: storage::load_position, 16, "storage", "DocId", "PositionRecord|null";
    save_session: storage::save_session, 17, "storage", "SaveSessionRequest", "SaveResult";
    load_session: storage::load_session, 18, "storage", "()", "SessionSnapshot|null";
    get_storage_overview: storage::get_storage_overview, 19, "storage", "()", "StorageOverview";
    clear_records: storage::clear_records, 20, "storage", "ClearRecordsRequest", "ClearResult[]";
    resume_recording: storage::resume_recording, 21, "storage", "ResumeRecordingRequest|null", "{}";
    get_settings: storage::get_settings, 22, "storage", "()", "SettingsBundle";
    update_settings: storage::update_settings, 23, "storage", "UpdateSettingsRequest", "UpdateSettingsResult";
    check_resource_access: auth::check_resource_access, 24, "auth", "CheckResourceAccessRequest", "AccessDecision";
    grant_local_root: auth::grant_local_root, 25, "auth", "GrantLocalRootRequest", "GrantRecord";
    list_grants: auth::list_grants, 26, "auth", "()", "GrantRecord[]";
    revoke_grant: auth::revoke_grant, 27, "auth", "GrantId", "RevokeResult";
    grant_remote_session: resources::grant_remote_session, 28, "resources", "GrantRemoteSessionRequest", "GrantRecord";
    revoke_remote_session: resources::revoke_remote_session, 29, "resources", "DocId", "RevokeResult";
    fetch_remote_image: resources::fetch_remote_image, 30, "resources", "FetchRemoteImageRequest", "RemoteImageResult";
    open_external_url: app::open_external_url, 31, "app", "Url", "{}";
    reveal_in_folder: app::reveal_in_folder, 32, "app", "Path", "{}";
    get_app_info: app::get_app_info, 33, "app", "()", "AppInfo";
    read_legal_text: app::read_legal_text, 34, "app", "ReadLegalTextRequest", "LegalTextResult";
    take_pending_open_requests: app::take_pending_open_requests, 35, "app", "()", "OpenRequest[]";
    preview_diagnostics: diagnostics::preview_diagnostics, 36, "diagnostics", "DiagnosticsPreviewRequest", "DiagnosticsPreview";
    export_diagnostics: diagnostics::export_diagnostics, 37, "diagnostics", "ExportDiagnosticsRequest", "ExportResult";
    search_source: files::search_source, 38, "files", "SearchSourceRequest", "SourceSearchResult";
];

/// Runs one blocking command body on the blocking pool and maps the result to
/// the wire error, recording document-scoped failures as diagnostics issues.
/// Commands never run blocking file/SQLite work on the async runtime
/// (data-model §7).
pub(crate) async fn dispatch<T, F>(
    app: AppHandle,
    doc_id: Option<String>,
    task: F,
) -> Result<T, ErrorPayload>
where
    T: Send + 'static,
    F: FnOnce(&AppHandle, &AppState) -> Result<T, AppError> + Send + 'static,
{
    let joined = tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<AppState>();
        let result = task(&app, state.inner());
        if let Err(error) = &result {
            state.diagnostics.record_app_error(doc_id.as_deref(), error);
        }
        result.map_err(|error| error.to_payload())
    })
    .await;
    match joined {
        Ok(outcome) => outcome,
        Err(_) => Err(internal_payload("command task failed to complete")),
    }
}

pub(crate) fn internal_payload(message: &str) -> ErrorPayload {
    AppError::new(ErrorCode::Internal)
        .with_message(message)
        .to_payload()
}

pub(crate) fn now_ms() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => i64::try_from(duration.as_millis()).unwrap_or(i64::MAX),
        Err(_) => 0,
    }
}

/// App section shared by `get_app_info` and `preview_diagnostics`.
pub(crate) fn diagnostics_app_info(info: &InfoService) -> DiagnosticsAppInfo {
    let app = info.app_info();
    DiagnosticsAppInfo {
        name: app.name,
        version: app.version,
        ipc_contract: app.ipc_contract,
        tauri_version: app.tauri_version,
        webkit_version: app.webkit_version,
        os: app.os,
    }
}

/// Rust-generated asset URL for an authorized local file (contracts §2.1
/// command 24; R25: the frontend never builds these itself). The `?v=`
/// observation key (mtime + size) lets the frontend invalidate the WebView
/// cache when the resource changes (contracts §7.6).
///
/// NOTE: the WebView can only serve the URL once the `tauri` `protocol-asset`
/// feature is enabled in `Cargo.toml` (security-model §6); that manifest line
/// is outside this work package's write scope (see the evidence report).
pub(crate) fn asset_url(app: &AppHandle, path: &std::path::Path) -> Result<String, AppError> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        AppError::new(ErrorCode::Internal).with_message("main window is unavailable")
    })?;
    let base = window.convert_file_src(path, None).map_err(|error| {
        AppError::new(ErrorCode::Internal)
            .with_message("asset URL conversion failed")
            .with_source(error)
    })?;
    Ok(format!("{base}?v={}", observation_key(path)))
}

fn observation_key(path: &std::path::Path) -> String {
    match std::fs::metadata(path) {
        Ok(metadata) => {
            let modified_ms = metadata
                .modified()
                .ok()
                .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis())
                .unwrap_or(0);
            format!("{modified_ms:x}-{:x}", metadata.len())
        }
        Err(_) => "0".to_owned(),
    }
}
