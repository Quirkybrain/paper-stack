//! Watch subscription commands: contracts §2 rows 11–12, §7.

use std::path::{Path, PathBuf};

use tauri::AppHandle;

use crate::error::{AppError, ErrorCode};
use crate::models::WatchRequest;
use crate::services::diagnostics::{LogCategory, LogEvent, LogField, LogLevel};
use crate::services::paths::{LocalReadOutcome, SystemPathProbe};
use crate::state::lock;

use super::dispatch;
use super::files::authorize_registered;

/// Command 11: registers (or replaces) the watch of one document and its
/// validated local resource set (contracts §7.1). Resource references that
/// are not local/authorized are skipped with a diagnostic instead of failing
/// the document watch.
#[tauri::command]
pub async fn watch_document(
    app: AppHandle,
    req: WatchRequest,
) -> Result<(), crate::models::ErrorPayload> {
    dispatch(app, Some(req.doc_id.clone()), move |_app, state| {
        let doc_path = authorize_registered(state, &req.doc_id)?;
        let base_dir = Path::new(&doc_path)
            .parent()
            .map(PathBuf::from)
            .ok_or_else(|| {
                AppError::new(ErrorCode::Internal).with_message("document has no parent")
            })?;

        let mut resources = Vec::new();
        for raw in req.resource_paths.unwrap_or_default() {
            let outcome = {
                let mut auth = lock(&state.auth);
                auth.authorize_local_read(&SystemPathProbe, &base_dir, &raw)
            };
            match outcome {
                Ok(LocalReadOutcome::Authorized(read)) => {
                    resources.push(read.canonical_path.to_string_lossy().into_owned())
                }
                Ok(LocalReadOutcome::Remote { .. }) => {
                    state.diagnostics.log(&LogEvent {
                        level: LogLevel::Debug,
                        category: LogCategory::Watch,
                        event: "watch_resource_skipped",
                        fields: vec![LogField::Text {
                            key: "code",
                            value: "remote",
                        }],
                    });
                }
                Err(error) => {
                    state.diagnostics.log(&LogEvent {
                        level: LogLevel::Debug,
                        category: LogCategory::Watch,
                        event: "watch_resource_skipped",
                        fields: vec![LogField::Text {
                            key: "code",
                            value: error.code().as_str(),
                        }],
                    });
                }
            }
        }

        let watch = lock(&state.watch);
        let runtime = watch.runtime().ok_or_else(|| {
            AppError::new(ErrorCode::Internal).with_message("watch runtime unavailable")
        })?;
        runtime.watch_document(&req.doc_id, Path::new(&doc_path), &resources)
    })
    .await
}

/// Command 12: removes a registration; unknown documents succeed
/// (contracts §1.7/§7.7).
#[tauri::command]
pub async fn unwatch_document(
    app: AppHandle,
    doc_id: String,
) -> Result<(), crate::models::ErrorPayload> {
    dispatch(app, Some(doc_id.clone()), move |_app, state| {
        let watch = lock(&state.watch);
        match watch.runtime() {
            Some(runtime) => runtime.unwatch_document(&doc_id),
            None => Ok(()),
        }
    })
    .await
}
