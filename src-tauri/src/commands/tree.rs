//! Directory tree commands: contracts §2 rows 9–10.

use std::path::Path;

use tauri::AppHandle;

use crate::error::AppError;
use crate::models::{DirectoryListing, DirectoryRoot, OpenDirectoryRequest, ReadDirectoryRequest};
use crate::services::auth::AuthRegistry;
use crate::services::tree::TreeService;
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

/// Command 10: one lazy directory level inside a registered root. The root is
/// only served while a valid directory grant still covers its canonical path
/// (INV-AZ-06; security-model §2.1: revoke stops new scans immediately).
#[tauri::command]
pub async fn read_directory(
    app: AppHandle,
    req: ReadDirectoryRequest,
) -> Result<DirectoryListing, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        // Lock order is tree → auth everywhere; no path acquires them in the
        // opposite order, so the two-domain check cannot deadlock.
        let tree = lock(&state.tree);
        let auth = lock(&state.auth);
        read_directory_checked(&tree, &auth, &req.root_id, &req.dir_path)
    })
    .await
}

/// Testable body of command 10: the registered root must still be authorized
/// (`revoke_grant` on the directory grant or `clear_records(["authorizations"])`
/// both empty the registry, so the scan stops with `PS_AUTH_REVOKED`). An
/// explicit `open_directory` re-establishes the grant (R25).
pub fn read_directory_checked(
    tree: &TreeService,
    auth: &AuthRegistry,
    root_id: &str,
    dir_path: &str,
) -> Result<DirectoryListing, AppError> {
    tree.read_directory_checked(root_id, dir_path, |root| auth.has_local_access(root))
}
