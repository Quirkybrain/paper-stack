//! Session tab persistence mapping and restore-read helpers (contracts §3.4;
//! data-model §3.4/§6; models §10).
//!
//! Storage owns the SQL; this module normalizes the wire `SessionTab` set,
//! rejects structurally broken saves, and adapts the stored snapshot for
//! restore. When to save or restore stays in the command layer (wp-15).

use std::collections::BTreeSet;

use crate::error::{AppError, ErrorCode};
use crate::models::{SaveResult, SessionSnapshot, SessionTab};
use crate::services::storage::Storage;

/// Sorts tabs by `orderIndex` (tie-break `tabId`), rejects duplicate `tabId`
/// or `docId` values, and collapses multiple active flags to the first active
/// tab in normalized order (defensive: the frontend keeps exactly one active
/// tab, INV-TL-01/INV-TL-07).
pub fn normalize_tabs(tabs: &[SessionTab]) -> Result<Vec<SessionTab>, AppError> {
    let mut seen_tabs = BTreeSet::new();
    let mut seen_docs = BTreeSet::new();
    for tab in tabs {
        if !seen_tabs.insert(tab.tab_id.as_str()) {
            return Err(AppError::new(ErrorCode::Internal)
                .with_message(format!("duplicate tabId {:?} in session", tab.tab_id)));
        }
        if !seen_docs.insert(tab.doc_id.as_str()) {
            return Err(AppError::new(ErrorCode::Internal)
                .with_message(format!("duplicate docId {:?} in session", tab.doc_id)));
        }
    }
    let mut ordered: Vec<SessionTab> = tabs.to_vec();
    ordered.sort_by(|a, b| {
        a.order_index
            .cmp(&b.order_index)
            .then_with(|| a.tab_id.cmp(&b.tab_id))
    });
    let mut active_taken = false;
    for tab in &mut ordered {
        if tab.is_active && !active_taken {
            active_taken = true;
        } else {
            tab.is_active = false;
        }
    }
    Ok(ordered)
}

/// The active tab id of a normalized tab set, if any.
pub fn active_tab_id(tabs: &[SessionTab]) -> Option<String> {
    tabs.iter()
        .find(|tab| tab.is_active)
        .map(|tab| tab.tab_id.clone())
}

/// Normalizes and persists the session (`save_session` command core). Honors
/// the session write gate: a suppressed or failed save is returned as
/// `SaveResult { saved: false, .. }`, not an error (data-model §6).
pub fn persist_session(
    storage: &Storage,
    tabs: &[SessionTab],
    saved_at_ms: i64,
) -> Result<SaveResult, AppError> {
    let normalized = normalize_tabs(tabs)?;
    Ok(storage.save_session_tabs(&normalized, saved_at_ms))
}

/// Restore-read helper (`load_session` command core). Tolerant on read:
/// orders tabs and recomputes `is_active` from the stored active tab id; a
/// stale active id is dropped rather than failing the restore.
pub fn restore_session(storage: &Storage) -> Result<Option<SessionSnapshot>, AppError> {
    let Some(mut snapshot) = storage.load_session_snapshot()? else {
        return Ok(None);
    };
    snapshot.tabs.sort_by(|a, b| {
        a.order_index
            .cmp(&b.order_index)
            .then_with(|| a.tab_id.cmp(&b.tab_id))
    });
    if let Some(active) = snapshot.active_tab_id.clone() {
        if !snapshot.tabs.iter().any(|tab| tab.tab_id == active) {
            snapshot.active_tab_id = None;
        }
    }
    let active = snapshot.active_tab_id.clone();
    for tab in &mut snapshot.tabs {
        tab.is_active = active.as_deref() == Some(tab.tab_id.as_str());
    }
    Ok(Some(snapshot))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tab(tab_id: &str, doc_id: &str, order: u64, active: bool) -> SessionTab {
        SessionTab {
            tab_id: tab_id.to_owned(),
            doc_id: doc_id.to_owned(),
            order_index: order,
            is_active: active,
        }
    }

    #[test]
    fn normalize_sorts_and_collapses_multiple_active_flags() {
        let normalized = normalize_tabs(&[
            tab("t-2", "d-2", 5, true),
            tab("t-1", "d-1", 1, true),
            tab("t-3", "d-3", 3, false),
        ])
        .unwrap();
        let order: Vec<&str> = normalized.iter().map(|t| t.tab_id.as_str()).collect();
        assert_eq!(order, ["t-1", "t-3", "t-2"]);
        assert_eq!(active_tab_id(&normalized).as_deref(), Some("t-1"));
        assert_eq!(normalized.iter().filter(|t| t.is_active).count(), 1);
    }

    #[test]
    fn normalize_rejects_duplicate_tab_or_document_ids() {
        let duplicate_tab =
            normalize_tabs(&[tab("t-1", "d-1", 0, false), tab("t-1", "d-2", 1, false)]);
        assert_eq!(duplicate_tab.unwrap_err().code(), ErrorCode::Internal);
        let duplicate_doc =
            normalize_tabs(&[tab("t-1", "d-1", 0, false), tab("t-2", "d-1", 1, false)]);
        assert_eq!(duplicate_doc.unwrap_err().code(), ErrorCode::Internal);
    }
}
