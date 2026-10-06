//! Session tab persistence mapping and restore helpers (T-13; contracts §3.4;
//! models §10). Storage-side SQL is covered by `storage_records.rs`; this file
//! exercises `services/session.rs`.

use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::{SessionTab, StorageCategory};
use paperstack_lib::services::session::{normalize_tabs, persist_session, restore_session};
use paperstack_lib::services::storage::{DocumentRecord, Storage};
use rusqlite::Connection;
use tempfile::TempDir;

fn document(doc_id: &str, canonical_path: &str) -> DocumentRecord {
    DocumentRecord {
        doc_id: doc_id.to_owned(),
        canonical_path: canonical_path.to_owned(),
        display_name: "doc.md".to_owned(),
        format: paperstack_lib::models::DocumentFormat::Markdown,
        encoding: paperstack_lib::models::TextEncoding::Utf8,
        content_hash: None,
        size_bytes: None,
        last_seen_at_ms: 1,
    }
}

fn tab(tab_id: &str, doc_id: &str, order: u64, active: bool) -> SessionTab {
    SessionTab {
        tab_id: tab_id.to_owned(),
        doc_id: doc_id.to_owned(),
        order_index: order,
        is_active: active,
    }
}

fn open_fixture() -> (TempDir, Storage) {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path()).unwrap();
    storage
        .upsert_document(&document("d-1", "/notes/a.md"))
        .unwrap();
    storage
        .upsert_document(&document("d-2", "/notes/b.md"))
        .unwrap();
    (temp, storage)
}

#[test]
fn persist_and_restore_round_trip_orders_tabs_and_keeps_the_active_tab() {
    let (_temp, storage) = open_fixture();
    let result = persist_session(
        &storage,
        &[tab("t-2", "d-2", 2, false), tab("t-1", "d-1", 1, true)],
        700,
    )
    .unwrap();
    assert!(result.saved);

    let snapshot = restore_session(&storage).unwrap().unwrap();
    let order: Vec<&str> = snapshot
        .tabs
        .iter()
        .map(|tab| tab.tab_id.as_str())
        .collect();
    assert_eq!(order, ["t-1", "t-2"]);
    assert_eq!(snapshot.active_tab_id.as_deref(), Some("t-1"));
    assert_eq!(snapshot.saved_at_ms, 700);
    assert!(snapshot.tabs[0].is_active);
    assert!(!snapshot.tabs[1].is_active);
}

#[test]
fn restore_returns_none_when_no_session_was_ever_saved() {
    let (_temp, storage) = open_fixture();
    assert!(restore_session(&storage).unwrap().is_none());
}

#[test]
fn restore_drops_a_stale_active_tab_id() {
    let (temp, storage) = open_fixture();
    persist_session(&storage, &[tab("t-1", "d-1", 1, true)], 800).unwrap();

    // Simulate a stale meta row pointing at a tab that no longer exists.
    {
        let connection = Connection::open(temp.path().join("paperstack.sqlite3")).unwrap();
        connection
            .execute(
                "UPDATE session_meta SET value_json = '\"t-missing\"' WHERE key = 'active_tab_id'",
                [],
            )
            .unwrap();
    }
    let snapshot = restore_session(&storage).unwrap().unwrap();
    assert_eq!(snapshot.active_tab_id, None);
    assert!(snapshot.tabs.iter().all(|tab| !tab.is_active));
}

#[test]
fn persist_rejects_duplicate_tab_ids_and_document_ids() {
    let (_temp, storage) = open_fixture();
    let duplicate_tabs = persist_session(
        &storage,
        &[tab("t-1", "d-1", 0, false), tab("t-1", "d-2", 1, false)],
        1,
    )
    .unwrap_err();
    assert_eq!(duplicate_tabs.code(), ErrorCode::Internal);
    let duplicate_docs = persist_session(
        &storage,
        &[tab("t-1", "d-1", 0, false), tab("t-2", "d-1", 1, false)],
        1,
    )
    .unwrap_err();
    assert_eq!(duplicate_docs.code(), ErrorCode::Internal);
}

#[test]
fn persist_respects_the_session_write_suppression() {
    let (temp, storage) = open_fixture();
    let results = storage.clear_records(
        &[StorageCategory::Session],
        true,
        &temp.path().join("cache"),
    );
    assert_eq!(results[0].cleared, 0);
    let result = persist_session(&storage, &[tab("t-1", "d-1", 0, true)], 900).unwrap();
    assert!(!result.saved);
    assert!(result.error.is_none());
    assert!(restore_session(&storage).unwrap().is_none());
    assert!(!storage.write_allowed(StorageCategory::Session));
}

#[test]
fn normalize_is_idempotent_for_an_already_normalized_set() {
    let normalized =
        normalize_tabs(&[tab("t-2", "d-2", 2, false), tab("t-1", "d-1", 1, true)]).unwrap();
    assert_eq!(normalize_tabs(&normalized).unwrap(), normalized);
}
