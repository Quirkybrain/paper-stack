//! File/dialog/document commands: contracts §2 rows 1–8 and 38.

use std::path::Path;

use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::error::{AppError, ErrorCode};
use crate::models::{
    DocumentSnapshot, OpenDocumentsRequest, OpenDocumentsResult, OpenEntry, OpenOutcome,
    OpenStatus, PickResult, ReadDocumentRequest, ReadSourceWindowRequest, RelinkRequest,
    RelinkResult, SearchSourceRequest, SourceInfo, SourceSearchResult, SourceWindow,
};
use crate::services::storage::DocumentRecord;
use crate::state::{lock, AppState};

use super::{dispatch, now_ms};

const MARKDOWN_FILTER_EXTENSIONS: [&str; 2] = ["md", "markdown"];

/// Command 1: open-file picker (Rust-side dialog plugin only; the picker
/// result is not an authorization — `open_documents` decides, R25).
#[tauri::command]
pub async fn pick_files(app: AppHandle) -> Result<PickResult, crate::models::ErrorPayload> {
    dispatch(app, None, |app, _state| {
        let picked = app
            .dialog()
            .file()
            .add_filter("Markdown", &MARKDOWN_FILTER_EXTENSIONS)
            .blocking_pick_files();
        Ok(pick_result(picked.unwrap_or_default()))
    })
    .await
}

/// Command 2: directory picker.
#[tauri::command]
pub async fn pick_directory(app: AppHandle) -> Result<PickResult, crate::models::ErrorPayload> {
    dispatch(app, None, |app, _state| {
        let picked = app.dialog().file().blocking_pick_folder();
        Ok(pick_result(picked.into_iter().collect()))
    })
    .await
}

/// Command 3: save-dialog target for diagnostics export.
#[tauri::command]
pub async fn pick_export_target(app: AppHandle) -> Result<PickResult, crate::models::ErrorPayload> {
    dispatch(app, None, |app, _state| {
        let picked = app
            .dialog()
            .file()
            .set_file_name("paperstack-diagnostics.txt")
            .blocking_save_file();
        Ok(pick_result(picked.into_iter().collect()))
    })
    .await
}

fn pick_result(picked: Vec<tauri_plugin_dialog::FilePath>) -> PickResult {
    let paths: Vec<String> = picked
        .into_iter()
        .filter_map(|path| path.into_path().ok())
        .map(|path| path.to_string_lossy().into_owned())
        .collect();
    PickResult {
        cancelled: paths.is_empty(),
        paths,
    }
}

/// Command 4: per-item validation, decoding and single-file read
/// authorization (contracts §2.1; R01/R05/R25). Failures are per item; the
/// batch keeps input order. `entry != "restore"` resumes record write-back
/// (data-model §6).
#[tauri::command]
pub async fn open_documents(
    app: AppHandle,
    req: OpenDocumentsRequest,
) -> Result<OpenDocumentsResult, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let mut items = Vec::with_capacity(req.paths.len());
        for path in &req.paths {
            items.push(open_one(state, path));
        }
        if req.entry != OpenEntry::Restore {
            if let Some(storage) = &state.storage {
                storage.resume_after_explicit_open();
            }
        }
        Ok(OpenDocumentsResult { items })
    })
    .await
}

fn open_one(state: &AppState, raw_path: &str) -> OpenOutcome {
    let opened = {
        let mut files = lock(&state.files);
        match files.open_document(raw_path) {
            Ok(opened) => opened,
            Err(error) => {
                state.diagnostics.record_app_error(None, &error);
                return OpenOutcome {
                    path: raw_path.to_owned(),
                    status: OpenStatus::Rejected,
                    doc_id: None,
                    identity: None,
                    duplicate_of_doc_id: None,
                    error: Some(error.to_payload()),
                };
            }
        }
    };

    let canonical = opened.identity.canonical_path.clone();
    let now = now_ms();
    // A user-selected open is the authorization decision (security-model
    // §2.1): register the persistent single-file grant, falling back to a
    // session grant when persistence is degraded (NF08).
    {
        let mut auth = lock(&state.auth);
        if let Err(error) = auth.grant_file(Path::new(&canonical), now) {
            state.diagnostics.record_app_error(None, &error);
            auth.grant_file_session(Path::new(&canonical), now);
        }
    }
    // Persist the document identity so recents/positions reference it
    // (data-model §2 `documents`). A degraded record write never fails the
    // open (NF08).
    if let Some(storage) = &state.storage {
        let record = DocumentRecord {
            doc_id: opened.doc_id.clone(),
            canonical_path: canonical,
            display_name: opened.identity.display_name.clone(),
            format: opened.identity.format,
            encoding: opened.identity.encoding,
            content_hash: Some(opened.identity.content_hash.clone()),
            size_bytes: Some(opened.identity.size_bytes),
            last_seen_at_ms: opened.identity.last_seen_at_ms,
        };
        if let Err(error) = storage.upsert_document(&record) {
            state.diagnostics.record_app_error(None, &error);
        }
    }

    OpenOutcome {
        path: raw_path.to_owned(),
        status: if opened.duplicate {
            OpenStatus::Duplicate
        } else {
            OpenStatus::Opened
        },
        doc_id: Some(opened.doc_id.clone()),
        identity: Some(opened.identity),
        duplicate_of_doc_id: opened.duplicate.then_some(opened.doc_id),
        error: None,
    }
}

/// Command 5: `initial|restore` may hit the validation snapshot cache;
/// `refresh` runs the stable read (contracts §2.1, §7.4). A revoked
/// authorization stops new reads before the service is called.
#[tauri::command]
pub async fn read_document(
    app: AppHandle,
    req: ReadDocumentRequest,
) -> Result<DocumentSnapshot, crate::models::ErrorPayload> {
    let doc_id = req.doc_id.clone();
    dispatch(app, Some(doc_id), move |_app, state| {
        authorize_registered(state, &req.doc_id)?;
        let mut files = lock(&state.files);
        files.read_document(&req.doc_id, req.purpose)
    })
    .await
}

/// Command 6: explicit user-selected replacement file; the selection is the
/// authorization decision (like an open). Same bytes reassociate, different
/// bytes become a new version of the same `docId` (R07).
#[tauri::command]
pub async fn relink_document(
    app: AppHandle,
    req: RelinkRequest,
) -> Result<RelinkResult, crate::models::ErrorPayload> {
    let doc_id = req.doc_id.clone();
    dispatch(app, Some(doc_id), move |_app, state| {
        let canonical = std::fs::canonicalize(&req.new_path).map_err(AppError::from_io_read)?;
        let now = now_ms();
        {
            let mut auth = lock(&state.auth);
            if !auth.has_local_access(&canonical) {
                if let Err(error) = auth.grant_file(&canonical, now) {
                    state.diagnostics.record_app_error(None, &error);
                    auth.grant_file_session(&canonical, now);
                }
            }
        }
        let mut files = lock(&state.files);
        files.relink_document(&req.doc_id, &req.new_path)
    })
    .await
}

/// Command 7: displayed-version info for an already-registered document.
#[tauri::command]
pub async fn get_source_info(
    app: AppHandle,
    doc_id: String,
) -> Result<SourceInfo, crate::models::ErrorPayload> {
    dispatch(app, Some(doc_id.clone()), move |_app, state| {
        authorize_registered(state, &doc_id)?;
        let mut files = lock(&state.files);
        files.get_source_info(&doc_id)
    })
    .await
}

/// Command 8: line-bounded source window of the displayed version.
#[tauri::command]
pub async fn read_source_window(
    app: AppHandle,
    req: ReadSourceWindowRequest,
) -> Result<SourceWindow, crate::models::ErrorPayload> {
    let doc_id = req.doc_id.clone();
    dispatch(app, Some(doc_id), move |_app, state| {
        authorize_registered(state, &req.doc_id)?;
        let mut files = lock(&state.files);
        files.read_source_window(&req)
    })
    .await
}

/// Command 38: literal streaming search for >50MiB source-window mode
/// (contracts §2.1; R17/R29).
#[tauri::command]
pub async fn search_source(
    app: AppHandle,
    req: SearchSourceRequest,
) -> Result<SourceSearchResult, crate::models::ErrorPayload> {
    let doc_id = req.doc_id.clone();
    dispatch(app, Some(doc_id), move |_app, state| {
        authorize_registered(state, &req.doc_id)?;
        let mut files = lock(&state.files);
        files.search_source(&req)
    })
    .await
}

/// Registered document + current read grant; revoked grants stop the read
/// with `PS_AUTH_REVOKED` (contracts §2 rows 5/7/8/38; R07/R25).
pub(crate) fn authorize_registered(state: &AppState, doc_id: &str) -> Result<String, AppError> {
    let canonical = {
        let files = lock(&state.files);
        files
            .document(doc_id)
            .map(|document| document.canonical_path().to_owned())
    };
    let canonical = canonical.ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
    let auth = lock(&state.auth);
    if !auth.has_local_access(Path::new(&canonical)) {
        return Err(AppError::new(ErrorCode::AuthRevoked));
    }
    Ok(canonical)
}
