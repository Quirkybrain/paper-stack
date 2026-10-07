//! Storage/settings commands: contracts §2 rows 13–23.

use tauri::AppHandle;

use crate::error::{AppError, ErrorCode};
use crate::models::{
    ClearRecordsRequest, ClearResult, FrozenLimits, GlobalSettings, PositionRecord, RecentEntry,
    ResumeRecordingRequest, SavePositionRequest, SaveResult, SaveSessionRequest, SessionSnapshot,
    SettingsBundle, StorageCategory, StorageOverview, UpdateSettingsRequest, UpdateSettingsResult,
};
use crate::services::diagnostics::{LogCategory, LogEvent, LogField, LogLevel};
use crate::services::paths::SystemPathProbe;
use crate::services::session;
use crate::services::storage::apply_settings_patch;
use crate::state::{lock, storage_unavailable, AppState};

use super::resources::revoke_remote_cache;
use super::{dispatch, now_ms};

fn require_storage(
    state: &AppState,
) -> Result<&crate::services::storage::Storage, crate::error::AppError> {
    state.storage.as_ref().ok_or_else(storage_unavailable)
}

/// Command 13: ≤100 recent entries, newest first, with availability recheck.
#[tauri::command]
pub async fn list_recents(app: AppHandle) -> Result<Vec<RecentEntry>, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| {
        let storage = require_storage(state)?;
        storage.list_recents(&SystemPathProbe)
    })
    .await
}

/// Command 14: records/updates one recent entry (honors the write gate;
/// R06/R27).
#[tauri::command]
pub async fn touch_recent(
    app: AppHandle,
    doc_id: String,
) -> Result<(), crate::models::ErrorPayload> {
    dispatch(app, Some(doc_id.clone()), move |_app, state| {
        let storage = require_storage(state)?;
        let result = storage.touch_recent(&doc_id, now_ms());
        match result.error {
            Some(error) => Err(crate::error::AppError::from_payload(&error)),
            None => Ok(()),
        }
    })
    .await
}

/// Command 15: saves a reading anchor; suppressed writes are
/// `SaveResult{saved:false}` (R19/R27).
#[tauri::command]
pub async fn save_position(
    app: AppHandle,
    req: SavePositionRequest,
) -> Result<SaveResult, crate::models::ErrorPayload> {
    let doc_id = req.doc_id.clone();
    dispatch(app, Some(doc_id), move |_app, state| {
        let storage = require_storage(state)?;
        Ok(storage.save_position(&req.doc_id, &req.anchor, now_ms()))
    })
    .await
}

/// Command 16: last committed position, if any.
#[tauri::command]
pub async fn load_position(
    app: AppHandle,
    doc_id: String,
) -> Result<Option<PositionRecord>, crate::models::ErrorPayload> {
    dispatch(app, Some(doc_id.clone()), move |_app, state| {
        let storage = require_storage(state)?;
        storage.load_position(&doc_id)
    })
    .await
}

/// Command 17: normalizes and persists the session tab set (R06).
#[tauri::command]
pub async fn save_session(
    app: AppHandle,
    req: SaveSessionRequest,
) -> Result<SaveResult, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let storage = require_storage(state)?;
        session::persist_session(storage, &req.tabs, now_ms())
    })
    .await
}

/// Command 18: stored session snapshot for restore.
#[tauri::command]
pub async fn load_session(
    app: AppHandle,
) -> Result<Option<SessionSnapshot>, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| {
        let storage = require_storage(state)?;
        session::restore_session(storage)
    })
    .await
}

/// Command 19: per-category usage; the `logs` category is owned by the
/// diagnostics service and merged here (T-13/T-18 boundary).
#[tauri::command]
pub async fn get_storage_overview(
    app: AppHandle,
) -> Result<StorageOverview, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| {
        let storage = require_storage(state)?;
        let mut overview = storage.storage_overview(&state.cache_dir)?;
        let (files, bytes) = state.diagnostics.log_usage();
        if let Some(entry) = overview
            .categories
            .iter_mut()
            .find(|entry| entry.category == StorageCategory::Logs)
        {
            entry.count = files;
            entry.bytes = Some(bytes);
        }
        Ok(overview)
    })
    .await
}

/// Command 20: per-category clear with explicit confirmation (R27). The
/// `logs` category is cleared through the diagnostics service.
#[tauri::command]
pub async fn clear_records(
    app: AppHandle,
    req: ClearRecordsRequest,
) -> Result<Vec<ClearResult>, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let mut results = match &state.storage {
            Some(storage) => storage.clear_records(&req.categories, req.confirm, &state.cache_dir),
            None => req
                .categories
                .iter()
                .map(|category| ClearResult {
                    category: *category,
                    cleared: 0,
                    error: Some(storage_unavailable().to_payload()),
                })
                .collect(),
        };
        if req.confirm {
            if let Some(index) = results
                .iter()
                .position(|result| result.category == StorageCategory::Logs)
            {
                results[index] = match state.diagnostics.clear_logs() {
                    Ok(cleared) => ClearResult {
                        category: StorageCategory::Logs,
                        cleared,
                        error: None,
                    },
                    Err(error) => ClearResult {
                        category: StorageCategory::Logs,
                        cleared: 0,
                        error: Some(error.to_payload()),
                    },
                };
            }
            // `authorizations` needs more than the row delete: the runtime
            // registry must revoke every in-memory grant and shrink the asset
            // scope (contracts §2.1; R25/R27). Applied only when the database
            // delete succeeded, so a failed clear cannot look cleared in
            // memory while the rows would resurrect at the next startup.
            if let Some(index) = results
                .iter()
                .position(|result| result.category == StorageCategory::Authorizations)
            {
                if results[index].error.is_none() {
                    let result = results[index].clone();
                    results[index] = apply_authorization_clear(state, result);
                }
            }
        }
        Ok(results)
    })
    .await
}

/// Runtime effect of clearing the `authorizations` category (IX12;
/// contracts §2.1): revokes every grant in the registry, shrinks the runtime
/// asset scope, and deletes the removed remote sessions' cache entries (R26).
/// Per-item scope failures are surfaced as the category error while the
/// actual cleared count stays visible.
fn apply_authorization_clear(state: &AppState, mut result: ClearResult) -> ClearResult {
    let outcome = lock(&state.auth).revoke_all_for_clear();
    let mut remote_failures = 0usize;
    let mut removed_cache_entries = 0u64;
    for doc_id in &outcome.remote_doc_ids {
        let report = revoke_remote_cache(state, doc_id);
        removed_cache_entries += report.removed_cache_entries;
        if report.failed_removals > 0 || report.scope_failures > 0 {
            remote_failures += 1;
            state.diagnostics.record_app_error(
                Some(doc_id.as_str()),
                &AppError::new(ErrorCode::RemoteFailed)
                    .with_message("remote cache cleanup was incomplete during authorization clear"),
            );
        }
    }
    state.diagnostics.log(&LogEvent {
        level: LogLevel::Info,
        category: LogCategory::Auth,
        event: "authorizations_cleared",
        fields: vec![
            LogField::Number {
                key: "removed",
                value: outcome.removed() as i64,
            },
            LogField::Number {
                key: "scopeFailed",
                value: outcome.scope_failed() as i64,
            },
            LogField::Number {
                key: "remoteDocuments",
                value: outcome.remote_doc_ids.len() as i64,
            },
            LogField::Number {
                key: "remoteCacheRemoved",
                value: removed_cache_entries as i64,
            },
        ],
    });
    if outcome.scope_failed() > 0 || remote_failures > 0 {
        result.error = Some(
            AppError::new(ErrorCode::Internal)
                .with_message(
                    "authorization records were cleared but the runtime scope could not be fully shrunk",
                )
                .to_payload(),
        );
    }
    result
}

/// Command 21: resumes record write-back; omitted categories resume all
/// (R27).
#[tauri::command]
pub async fn resume_recording(
    app: AppHandle,
    req: Option<ResumeRecordingRequest>,
) -> Result<(), crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        if let Some(storage) = &state.storage {
            let categories = req.and_then(|request| request.categories);
            storage.resume_recording(categories.as_deref());
        }
        Ok(())
    })
    .await
}

/// Command 22: settings bundle; a database failure degrades to the in-memory
/// value (initialized from defaults) and is reported through diagnostics
/// (contracts §2 row 22 "降级返回默认"; NF08).
#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<SettingsBundle, crate::models::ErrorPayload> {
    dispatch(app, None, |_app, state| {
        let mut cache = lock(&state.settings);
        if let Some(storage) = &state.storage {
            match storage.load_settings() {
                Ok(global) => {
                    cache.global = global;
                    cache.revision = cache.revision.max(storage.settings_revision());
                }
                Err(error) => state.diagnostics.record_app_error(None, &error),
            }
        }
        Ok(SettingsBundle {
            global: cache.global.clone(),
            defaults: GlobalSettings::default(),
            limits: FrozenLimits::default(),
            revision: cache.revision,
        })
    })
    .await
}

/// Command 23: applies to memory first, then persists; a failed persistence
/// keeps the applied value and returns the error for UI notification
/// (R23; `applied`/`persisted` separation).
#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    req: UpdateSettingsRequest,
) -> Result<UpdateSettingsResult, crate::models::ErrorPayload> {
    dispatch(app, None, move |_app, state| {
        let mut cache = lock(&state.settings);
        let previous = cache.global.clone();
        let applied = apply_settings_patch(&previous, &req.patch);
        let mut persisted = false;
        let mut error = None;
        match &state.storage {
            Some(storage) => match storage.update_settings(&req.patch, now_ms()) {
                Ok(next) => {
                    cache.global = next;
                    persisted = true;
                }
                Err(failure) => {
                    state.diagnostics.record_app_error(None, &failure);
                    cache.global = applied;
                    error = Some(failure.to_payload());
                }
            },
            None => {
                cache.global = applied;
                error = Some(storage_unavailable().to_payload());
            }
        }
        if cache.global != previous {
            cache.revision = cache.revision.saturating_add(1);
        }
        Ok(UpdateSettingsResult {
            applied: cache.global.clone(),
            persisted,
            revision: cache.revision,
            error,
        })
    })
    .await
}
