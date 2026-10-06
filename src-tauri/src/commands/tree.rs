//! Directory tree commands: contracts §2 rows 9–10.

use std::path::Path;

use tauri::AppHandle;

use crate::models::{DirectoryListing, DirectoryRoot, OpenDirectoryRequest, ReadDirectoryRequest};
use crate::state::lock;

use super::{dispatch, now_ms};

/// Command 9: opens a directory root and registers the matching directory
/// grant (session by default; persistent only when `persist=true`, R25).
#[tauri::command]
pub async fn open_directory(
    app: AppHandle,
    req: OpenDirectoryRequest,
) -> Result<DirectoryRoot, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let root = {
            let mut tree = lock(&state.tree);
            tree.open_directory(&req.path, req.persist)?
        };
        let canonical = Path::new(&root.canonical_path);
        let now = now_ms();
        let mut auth = lock(&state.auth);
        if let Err(error) = auth.grant_directory(canonical, req.persist, now) {
            state.diagnostics.record_app_error(None, &error);
            if let Err(error) = auth.grant_directory_session(canonical, now) {
                state.diagnostics.record_app_error(None, &error);
            }
        }
        Ok(root)
    })
    .await
}

/// Command 10: one lazy directory level inside a registered root.
#[tauri::command]
pub async fn read_directory(
    app: AppHandle,
    req: ReadDirectoryRequest,
) -> Result<DirectoryListing, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let tree = lock(&state.tree);
        tree.read_directory(&req.root_id, &req.dir_path)
    })
    .await
}
