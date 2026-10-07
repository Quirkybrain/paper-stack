//! Diagnostics commands: contracts §2 rows 36–37, security-model §7.

use tauri::AppHandle;

use crate::models::{
    DiagnosticsLimits, DiagnosticsPreview, DiagnosticsPreviewRequest, ExportDiagnosticsRequest,
    ExportResult, FrozenLimits,
};
use crate::services::diagnostics::{
    DocumentDiagnosticsInput, LogCategory, LogEvent, LogField, LogLevel, ProtectedSources,
    LARGE_FILE_BYTES,
};
use crate::services::files::HARD_LIMIT_BYTES;
use crate::services::resources::REMOTE_MAX_BYTES;
use crate::state::{lock, AppState};

use super::{diagnostics_app_info, dispatch};

/// Command 36: redacted preview; defaults exclude source context and full
/// paths (R28), the `exportId` stores the exact export bytes.
#[tauri::command]
pub async fn preview_diagnostics(
    app: AppHandle,
    req: DiagnosticsPreviewRequest,
) -> Result<DiagnosticsPreview, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let documents = collect_documents(state);
        let app_info = diagnostics_app_info(&state.info);
        Ok(state
            .diagnostics
            .preview(&req, app_info, &documents, diagnostics_limits()))
    })
    .await
}

/// Command 37: writes the stored preview bytes to a validated, non-source
/// target with explicit overwrite confirmation (security-model §7).
#[tauri::command]
pub async fn export_diagnostics(
    app: AppHandle,
    req: ExportDiagnosticsRequest,
) -> Result<ExportResult, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let protected = collect_protected_sources(state);
        let result = state.diagnostics.export(&req, &protected)?;
        state.diagnostics.log(&LogEvent {
            level: LogLevel::Info,
            category: LogCategory::Diagnostics,
            event: "export_written",
            fields: vec![LogField::Number {
                key: "bytes",
                value: i64::try_from(result.bytes).unwrap_or(i64::MAX),
            }],
        });
        Ok(result)
    })
    .await
}

pub(crate) fn collect_documents(state: &AppState) -> Vec<DocumentDiagnosticsInput> {
    let files = lock(&state.files);
    files
        .registered_documents()
        .map(|document| DocumentDiagnosticsInput {
            doc_id: document.doc_id().to_owned(),
            display_name: document.display_name().to_owned(),
            canonical_path: Some(document.canonical_path().to_owned()),
            version_hash: document.version().content_hash.clone(),
            status: if document.is_full_read() {
                "ok".to_owned()
            } else {
                "source-only".to_owned()
            },
        })
        .collect()
}

pub(crate) fn collect_protected_sources(state: &AppState) -> ProtectedSources {
    let files = lock(&state.files);
    // Registered documents plus every known source location — including
    // documents whose open failed validation (decode/encoding errors), which
    // never register but still protect their source directory (AT28/D-34-7).
    let paths = files
        .registered_documents()
        .map(|document| document.canonical_path().to_owned())
        .chain(
            files
                .known_source_paths()
                .map(|path| path.to_string_lossy().into_owned()),
        );
    ProtectedSources::from_paths(paths)
}

pub(crate) fn diagnostics_limits() -> DiagnosticsLimits {
    DiagnosticsLimits {
        frozen: FrozenLimits::default(),
        large_file_bytes: LARGE_FILE_BYTES,
        hard_limit_bytes: HARD_LIMIT_BYTES,
        image_bytes: REMOTE_MAX_BYTES,
    }
}
