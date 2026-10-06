//! Remote-resource commands: contracts §2 rows 28–30, security-model §4.

use tauri::AppHandle;

use crate::error::{AppError, ErrorCode};
use crate::models::{
    FetchRemoteImageRequest, GrantRecord, GrantRemoteSessionRequest, RemoteImageResult,
    RevokeResult,
};
use crate::services::resources::{normalize_origin, RemoteService};
use crate::services::storage::resolve_cache_path;
use crate::state::lock;

use super::{asset_url, dispatch, now_ms};

/// Command 28: document-session origin allowance (R26). Origins are
/// normalized to `https://host[:port]` and validated through the remote
/// policy; persistence failure degrades to an in-memory session grant (NF08).
#[tauri::command]
pub async fn grant_remote_session(
    app: AppHandle,
    req: GrantRemoteSessionRequest,
) -> Result<GrantRecord, crate::models::ErrorPayload> {
    dispatch(app, Some(req.doc_id.clone()), move |_app, state| {
        let mut origins = Vec::with_capacity(req.origins.len());
        for origin in &req.origins {
            origins.push(normalize_origin(origin)?);
        }
        origins.sort();
        origins.dedup();
        if origins.is_empty() {
            return Err(AppError::new(ErrorCode::RemoteProtocol)
                .with_message("grant_remote_session requires at least one origin"));
        }
        {
            let files = lock(&state.files);
            if files.document(&req.doc_id).is_none() {
                return Err(AppError::new(ErrorCode::IoNotFound)
                    .with_message("remote allowances are per registered document session"));
            }
        }
        let now = now_ms();
        let mut auth = lock(&state.auth);
        match auth.grant_remote_session(&req.doc_id, &origins, now) {
            Ok(record) => Ok(record),
            Err(error) => {
                state.diagnostics.record_app_error(None, &error);
                auth.grant_remote_session_memory(&req.doc_id, &origins, now)
            }
        }
    })
    .await
}

/// Command 29: revokes the document's remote allowance and deletes its cache
/// entries; idempotent and never rejects (R26). Cache files that survive a
/// failed deletion are additionally forbidden in the asset scope (fail-closed:
/// a previously handed-out asset URL must not serve revoked bytes).
#[tauri::command]
pub async fn revoke_remote_session(
    app: AppHandle,
    doc_id: String,
) -> Result<RevokeResult, crate::models::ErrorPayload> {
    dispatch(app, Some(doc_id.clone()), move |_app, state| {
        // Must be read before `revoke_session`, which drops the bookkeeping.
        let cache_paths = {
            let remote = lock(&state.remote);
            remote
                .as_ref()
                .map(|service| service.session_cache_paths(&doc_id, &state.cache_dir))
                .unwrap_or_default()
        };
        let registry_result = lock(&state.auth).revoke_remote_session(&doc_id);
        let removed_cache_entries = {
            let mut remote = lock(&state.remote);
            remote
                .as_mut()
                .map(|service: &mut RemoteService| {
                    service.revoke_session(&doc_id).removed_cache_entries
                })
                .unwrap_or(0)
        };
        for path in cache_paths.iter().filter(|path| path.exists()) {
            state.asset_scope.revoke_file(path)?;
        }
        Ok(RevokeResult {
            revoked: registry_result.revoked,
            cancelled_requests: registry_result.cancelled_requests,
            removed_cache_entries,
        })
    })
    .await
}

/// Command 30: controlled fetch of one session-allowed remote image
/// (security-model §4). Returns a Rust-generated asset URL; no automatic
/// retry (the user re-invokes on failure).
#[tauri::command]
pub async fn fetch_remote_image(
    app: AppHandle,
    req: FetchRemoteImageRequest,
) -> Result<RemoteImageResult, crate::models::ErrorPayload> {
    dispatch(app, Some(req.doc_id.clone()), move |app, state| {
        let origins = lock(&state.auth).active_origins(&req.doc_id);
        if origins.is_empty() {
            return Err(AppError::new(ErrorCode::RemoteBlocked)
                .with_message("remote resource not allowed for this document session"));
        }
        let fetch = {
            let mut remote = lock(&state.remote);
            let service = remote
                .as_mut()
                .ok_or_else(crate::state::storage_unavailable)?;
            service.fetch(&req.doc_id, &req.url, &origins)?
        };
        let cache_path = resolve_cache_path(
            &state.cache_dir,
            &format!("remote-images/{}", fetch.cache_key),
        )
        .filter(|path| path.exists());
        let Some(cache_path) = cache_path else {
            // The controlled fetch succeeded but the bytes could not be
            // persisted as a cache file; there is no honest asset URL to hand
            // out (recorded limitation, see the wp-14 evidence report).
            return Err(AppError::new(ErrorCode::RemoteFailed)
                .with_message("remote image bytes are not available as an asset"));
        };
        // Only an authorized, successfully cached response becomes servable
        // (security-model §4/§6): expand the asset scope for this exact file
        // before the URL is generated.
        state.asset_scope.allow_file(&cache_path)?;
        let result = RemoteImageResult {
            asset_url: asset_url(app, &cache_path)?,
            mime: fetch.mime,
            size_bytes: fetch.size_bytes,
            final_url: fetch.final_url,
            cache_key: fetch.cache_key,
            from_cache: fetch.from_cache,
        };
        Ok(result)
    })
    .await
}
