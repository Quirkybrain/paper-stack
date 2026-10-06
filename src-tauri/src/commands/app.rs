//! Application/opener commands: contracts §2 rows 31–35.

use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, ErrorCode};
use crate::models::{AppInfo, LegalTextResult, OpenRequest, ReadLegalTextRequest};
use crate::services::info::{resolve_reveal_target, validate_external_url};
use crate::services::paths::SystemPathProbe;
use crate::state::lock;

use super::dispatch;

/// Command 31: opens one user-clicked external URL in the system browser.
/// Only `http`/`https` pass validation (R15); the opener plugin is
/// Rust-only (contracts §9).
#[tauri::command]
pub async fn open_external_url(
    app: AppHandle,
    url: String,
) -> Result<(), crate::models::ErrorPayload> {
    dispatch(app, None, move |app, _state| {
        let parsed = validate_external_url(&url)?;
        app.opener()
            .open_url(parsed.to_string(), None::<&str>)
            .map_err(|error| {
                AppError::new(ErrorCode::Internal)
                    .with_message("failed to open the external URL")
                    .with_source(error)
            })
    })
    .await
}

/// Command 32: reveals an authorized file/directory in the system file
/// manager (R07/R09). The target must be inside the current authorization
/// set before any OS call happens.
#[tauri::command]
pub async fn reveal_in_folder(
    app: AppHandle,
    path: String,
) -> Result<(), crate::models::ErrorPayload> {
    dispatch(app, None, move |app, state| {
        let canonical = {
            let auth = lock(&state.auth);
            resolve_reveal_target(&SystemPathProbe, &auth, &path)?
        };
        app.opener()
            .reveal_item_in_dir(&canonical)
            .map_err(|error| {
                AppError::new(ErrorCode::Internal)
                    .with_message("failed to reveal the target in the file manager")
                    .with_source(error)
            })
    })
    .await
}

/// Command 33: contract-fixed identity and legal availability (R30).
#[tauri::command]
pub async fn get_app_info(app: AppHandle) -> Result<AppInfo, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| Ok(state.info.app_info())).await
}

/// Command 34: bundled legal text; a missing resource is the graceful
/// `PS_IO_NOT_FOUND` path (R30).
#[tauri::command]
pub async fn read_legal_text(
    app: AppHandle,
    req: ReadLegalTextRequest,
) -> Result<LegalTextResult, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        state.info.read_legal_text(req.kind)
    })
    .await
}

/// Command 35: drains startup/single-instance open requests exactly once;
/// later handovers arrive as `paperstack://open-requested` events
/// (contracts §2.1 command 35, §4).
#[tauri::command]
pub async fn take_pending_open_requests(
    app: AppHandle,
) -> Result<Vec<OpenRequest>, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| {
        Ok(lock(&state.app).take_pending_open_requests())
    })
    .await
}
