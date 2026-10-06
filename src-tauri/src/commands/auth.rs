//! Authorization commands: contracts §2 rows 24–27.

use std::path::{Path, PathBuf};

use tauri::AppHandle;

use crate::error::{AppError, ErrorCode};
use crate::models::{
    AccessDecision, AccessDecisionStatus, AccessKind, CheckResourceAccessRequest,
    GrantLocalRootRequest, GrantRecord, RevokeResult,
};
use crate::services::paths::{self, LocalReadOutcome, ReferenceClass, SystemPathProbe};
use crate::services::resources::{normalize_origin, origin_allowed};
use crate::state::{lock, AppState};

use super::{asset_url, dispatch, now_ms};

/// Command 24: authorization decision for one document reference. Never
/// rejects (contracts §2.1): the status drives the UI, and only `allowed`
/// carries a Rust-generated asset URL (`?v=` observation key, R25).
#[tauri::command]
pub async fn check_resource_access(
    app: AppHandle,
    req: CheckResourceAccessRequest,
) -> Result<AccessDecision, crate::models::ErrorPayload> {
    dispatch(app, Some(req.doc_id.clone()), move |app, state| {
        Ok(decide_access(app, state, &req))
    })
    .await
}

fn decide_access(
    app: &AppHandle,
    state: &AppState,
    req: &CheckResourceAccessRequest,
) -> AccessDecision {
    let base_dir = {
        let files = lock(&state.files);
        files.document(&req.doc_id).and_then(|document| {
            Path::new(document.canonical_path())
                .parent()
                .map(PathBuf::from)
        })
    };
    let Some(base_dir) = base_dir else {
        return decision(
            AccessDecisionStatus::Denied,
            AccessKind::Other,
            Some(AppError::new(ErrorCode::IoNotFound)),
        );
    };

    match paths::classify_reference(&req.raw_src) {
        Err(error) => {
            let status = match error.code() {
                ErrorCode::ResourceUnsupported => AccessDecisionStatus::Unsupported,
                _ => AccessDecisionStatus::Denied,
            };
            decision(status, AccessKind::Other, Some(error))
        }
        Ok(ReferenceClass::Remote(raw)) => match normalize_origin(&raw) {
            Err(error) => decision(
                AccessDecisionStatus::Unsupported,
                AccessKind::Remote,
                Some(error),
            ),
            Ok(origin) => {
                let allowed = {
                    let auth = lock(&state.auth);
                    auth.active_origins(&req.doc_id)
                };
                if origin_allowed(&origin, &allowed) {
                    AccessDecision {
                        status: AccessDecisionStatus::Allowed,
                        kind: AccessKind::Remote,
                        canonical_path: None,
                        asset_url: None,
                        root_candidate: None,
                        origin: Some(origin),
                        reason: None,
                    }
                } else {
                    let mut value = decision(
                        AccessDecisionStatus::RemoteBlocked,
                        AccessKind::Remote,
                        Some(AppError::new(ErrorCode::RemoteBlocked)),
                    );
                    value.origin = Some(origin);
                    value
                }
            }
        },
        Ok(ReferenceClass::Local(_)) => {
            let outcome = {
                let mut auth = lock(&state.auth);
                auth.authorize_local_read(&SystemPathProbe, &base_dir, &req.raw_src)
            };
            match outcome {
                Ok(LocalReadOutcome::Authorized(read)) => {
                    match asset_url(app, &read.canonical_path) {
                        Ok(url) => AccessDecision {
                            status: AccessDecisionStatus::Allowed,
                            kind: AccessKind::Local,
                            canonical_path: Some(
                                read.canonical_path.to_string_lossy().into_owned(),
                            ),
                            asset_url: Some(url),
                            root_candidate: None,
                            origin: None,
                            reason: None,
                        },
                        Err(error) => {
                            decision(AccessDecisionStatus::Denied, AccessKind::Local, Some(error))
                        }
                    }
                }
                Ok(LocalReadOutcome::Remote { .. }) => decision(
                    AccessDecisionStatus::Unsupported,
                    AccessKind::Other,
                    Some(AppError::new(ErrorCode::Internal)),
                ),
                Err(error) => {
                    let status = match error.code() {
                        ErrorCode::ResourceMissing => AccessDecisionStatus::Missing,
                        ErrorCode::AuthOutsideRoot => AccessDecisionStatus::OutsideRoot,
                        ErrorCode::ResourceUnsupported => AccessDecisionStatus::Unsupported,
                        _ => AccessDecisionStatus::Denied,
                    };
                    let mut value = decision(status, AccessKind::Local, Some(error));
                    if value.status == AccessDecisionStatus::OutsideRoot {
                        value.root_candidate = value
                            .reason
                            .as_ref()
                            .and_then(|payload| payload.details.as_ref())
                            .and_then(|details| details.get("rootCandidate"))
                            .and_then(|value| match value {
                                crate::models::DetailValue::String(text) => Some(text.clone()),
                                _ => None,
                            });
                    }
                    value
                }
            }
        }
    }
}

fn decision(
    status: AccessDecisionStatus,
    kind: AccessKind,
    reason: Option<AppError>,
) -> AccessDecision {
    AccessDecision {
        status,
        kind,
        canonical_path: None,
        asset_url: None,
        root_candidate: None,
        origin: None,
        reason: reason.map(|error| error.to_payload()),
    }
}

/// Command 25: user confirmation of a directory root (R25). The requested
/// path must exist as a readable directory; the grant defaults to session
/// scope and only `persist=true` remembers it.
#[tauri::command]
pub async fn grant_local_root(
    app: AppHandle,
    req: GrantLocalRootRequest,
) -> Result<GrantRecord, crate::models::ErrorPayload> {
    dispatch(app, Some(req.doc_id.clone()), move |_app, state| {
        {
            let files = lock(&state.files);
            if files.document(&req.doc_id).is_none() {
                return Err(AppError::new(ErrorCode::IoNotFound)
                    .with_message("grant_local_root requires a registered document"));
            }
        }
        let canonical = std::fs::canonicalize(&req.root_path).map_err(AppError::from_io_read)?;
        let metadata = std::fs::metadata(&canonical).map_err(AppError::from_io_read)?;
        if !metadata.is_dir() {
            return Err(
                AppError::new(ErrorCode::IoNotFound).with_message("grant root is not a directory")
            );
        }
        std::fs::read_dir(&canonical).map_err(AppError::from_io_read)?;
        let now = now_ms();
        let mut auth = lock(&state.auth);
        match auth.grant_directory(&canonical, req.persist, now) {
            Ok(record) => Ok(record),
            Err(error) => {
                state.diagnostics.record_app_error(None, &error);
                Ok(auth.grant_directory_session(&canonical, now))
            }
        }
    })
    .await
}

/// Command 26: current grant records (in-memory registry).
#[tauri::command]
pub async fn list_grants(app: AppHandle) -> Result<Vec<GrantRecord>, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| Ok(lock(&state.auth).list())).await
}

/// Command 27: revokes one grant; revoked asset scope entries are removed
/// immediately (R07/R25).
#[tauri::command]
pub async fn revoke_grant(
    app: AppHandle,
    grant_id: String,
) -> Result<RevokeResult, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        lock(&state.auth).revoke(&grant_id)
    })
    .await
}
