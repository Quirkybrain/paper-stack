//! Write-gate matrix, categorized clearing and suppression semantics
//! (T-13; data-model §6; R27/INV-WB-01..09).

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::models::{
    AnchorRecord, GrantKind, GrantRecord, GrantScope, SessionTab, SourceRange, StorageCategory,
};
use paperstack_lib::services::storage::{CacheEntry, DocumentRecord, SidebarKind, Storage};
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

fn anchor(version_hash: &str) -> AnchorRecord {
    AnchorRecord {
        version_hash: version_hash.to_owned(),
        heading_path: Vec::new(),
        block_fingerprint: "fp1:0123456789abcdef".to_owned(),
        offset_ratio: 0.0,
        source_range: SourceRange {
            start_byte: 0,
            end_byte: 0,
        },
    }
}

fn cache_file(cache_dir: &Path, rel_path: &str, bytes: usize) {
    let path = cache_dir.join(rel_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, vec![b'x'; bytes]).unwrap();
}

fn cache_entry(cache_key: &str, rel_path: &str, size: u64) -> CacheEntry {
    CacheEntry {
        cache_key: cache_key.to_owned(),
        rel_path: rel_path.to_owned(),
        size_bytes: size,
        source_url_hash: None,
        created_at_ms: 1,
        last_access_at_ms: 1,
    }
}

struct Seeded {
    _temp: TempDir,
    storage: Storage,
    cache_dir: PathBuf,
}

/// Two recents, one position, two session tabs + meta + one sidebar row, two
/// cache rows (with files) and two grants.
fn seed_all() -> Seeded {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    let cache_dir = temp.path().join("cache");
    fs::create_dir_all(&cache_dir).unwrap();
    storage
        .upsert_document(&document("d-1", "/notes/a.md"))
        .unwrap();
    storage
        .upsert_document(&document("d-2", "/notes/b.md"))
        .unwrap();
    storage.touch_recent("d-1", 1);
    storage.touch_recent("d-2", 2);
    storage.save_position("d-1", &anchor("hash-1"), 3);
    storage.save_session_tabs(
        &[tab("t-1", "d-1", 0, true), tab("t-2", "d-2", 1, false)],
        4,
    );
    storage.save_sidebar_state(SidebarKind::Directory, "/notes", "{}", 5);
    cache_file(&cache_dir, "remote-images/a.bin", 10);
    cache_file(&cache_dir, "remote-images/b.bin", 20);
    storage
        .upsert_cache_entry(&cache_entry("c-a", "remote-images/a.bin", 10))
        .unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-b", "remote-images/b.bin", 20))
        .unwrap();
    storage
        .upsert_grant(&GrantRecord {
            grant_id: "g-file".to_owned(),
            kind: GrantKind::File,
            scope: GrantScope::Persistent,
            canonical_path: Some("/notes/a.md".to_owned()),
            origins: None,
            doc_id: None,
            granted_at_ms: 10,
        })
        .unwrap();
    storage
        .upsert_grant(&GrantRecord {
            grant_id: "g-remote".to_owned(),
            kind: GrantKind::Remote,
            scope: GrantScope::Session,
            canonical_path: None,
            origins: Some(vec!["https://example.com".to_owned()]),
            doc_id: Some("d-1".to_owned()),
            granted_at_ms: 11,
        })
        .unwrap();
    Seeded {
        _temp: temp,
        storage,
        cache_dir,
    }
}

#[test]
fn write_gate_matrix_by_category() {
    let seeded = seed_all();
    let storage = &seeded.storage;
    for category in [
        StorageCategory::Recents,
        StorageCategory::Positions,
        StorageCategory::Session,
    ] {
        assert!(
            storage.write_allowed(category),
            "{category:?} writable by default"
        );
    }
    assert!(storage.write_allowed(StorageCategory::Cache));
    assert!(storage.write_allowed(StorageCategory::Authorizations));
    assert!(!storage.write_allowed(StorageCategory::Logs));

    storage.clear_records(
        &[
            StorageCategory::Recents,
            StorageCategory::Positions,
            StorageCategory::Session,
        ],
        true,
        &seeded.cache_dir,
    );
    for category in [
        StorageCategory::Recents,
        StorageCategory::Positions,
        StorageCategory::Session,
    ] {
        assert!(storage.is_suppressed(category));
        assert!(!storage.write_allowed(category), "{category:?} suppressed");
    }
    // Cache and authorizations are never suppressed (data-model §6).
    assert!(storage.write_allowed(StorageCategory::Cache));
    assert!(storage.write_allowed(StorageCategory::Authorizations));

    storage.resume_recording(Some(&[StorageCategory::Positions]));
    assert!(storage.write_allowed(StorageCategory::Positions));
    assert!(!storage.write_allowed(StorageCategory::Recents));

    storage.resume_recording(None);
    for category in [
        StorageCategory::Recents,
        StorageCategory::Positions,
        StorageCategory::Session,
    ] {
        assert!(storage.write_allowed(category));
    }
}

#[test]
fn clear_records_requires_confirmation() {
    let seeded = seed_all();
    let results =
        seeded
            .storage
            .clear_records(&[StorageCategory::Recents], false, &seeded.cache_dir);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].cleared, 0);
    assert!(results[0].error.is_none());
    assert_eq!(seeded.storage.recents_count().unwrap(), 2);
    assert!(!seeded.storage.is_suppressed(StorageCategory::Recents));
}

#[test]
fn clear_records_reports_per_category_counts() {
    let seeded = seed_all();
    let results = seeded.storage.clear_records(
        &[
            StorageCategory::Recents,
            StorageCategory::Positions,
            StorageCategory::Session,
            StorageCategory::Cache,
            StorageCategory::Authorizations,
            StorageCategory::Logs,
        ],
        true,
        &seeded.cache_dir,
    );
    let cleared: Vec<(StorageCategory, u64)> = results
        .iter()
        .map(|result| (result.category, result.cleared))
        .collect();
    assert_eq!(
        cleared,
        vec![
            (StorageCategory::Recents, 2),
            (StorageCategory::Positions, 1),
            // 2 tabs + 2 session_meta rows + 1 sidebar row
            (StorageCategory::Session, 5),
            (StorageCategory::Cache, 2),
            (StorageCategory::Authorizations, 2),
            // logs are owned by diagnostics (wp-14)
            (StorageCategory::Logs, 0),
        ]
    );
    assert!(results.iter().all(|result| result.error.is_none()));
    assert_eq!(seeded.storage.recents_count().unwrap(), 0);
    assert!(seeded.storage.load_position("d-1").unwrap().is_none());
    assert!(seeded.storage.load_session_snapshot().unwrap().is_none());
    assert_eq!(seeded.storage.cache_count().unwrap(), 0);
    assert_eq!(seeded.storage.grants_count().unwrap(), 0);
    assert!(!seeded.cache_dir.join("remote-images/a.bin").exists());
    assert!(!seeded.cache_dir.join("remote-images/b.bin").exists());
}

#[test]
fn clearing_record_categories_sets_suppression_and_stops_write_back() {
    let seeded = seed_all();
    let storage = &seeded.storage;
    storage.clear_records(
        &[
            StorageCategory::Recents,
            StorageCategory::Positions,
            StorageCategory::Session,
        ],
        true,
        &seeded.cache_dir,
    );

    let touch = storage.touch_recent("d-1", 100);
    assert!(!touch.saved);
    assert!(touch.error.is_none());
    let position = storage.save_position("d-1", &anchor("hash-2"), 101);
    assert!(!position.saved);
    assert!(position.error.is_none());
    let session = storage.save_session_tabs(&[tab("t-1", "d-1", 0, true)], 102);
    assert!(!session.saved);
    assert!(session.error.is_none());
    let sidebar = storage.save_sidebar_state(SidebarKind::Directory, "/notes", "{}", 103);
    assert!(!sidebar.saved);
    assert!(sidebar.error.is_none());

    // Nothing was silently rebuilt (INV-WB-02).
    assert_eq!(storage.recents_count().unwrap(), 0);
    assert!(storage.load_position("d-1").unwrap().is_none());
    assert!(storage.load_session_snapshot().unwrap().is_none());

    // resume_recording restores only the listed categories.
    storage.resume_recording(Some(&[StorageCategory::Positions]));
    assert!(storage.save_position("d-1", &anchor("hash-3"), 200).saved);
    assert!(!storage.touch_recent("d-1", 201).saved);
    assert!(
        !storage
            .save_session_tabs(&[tab("t-1", "d-1", 0, true)], 202)
            .saved
    );

    storage.resume_recording(None);
    assert!(storage.touch_recent("d-1", 300).saved);
    assert!(
        storage
            .save_session_tabs(&[tab("t-1", "d-1", 0, true)], 301)
            .saved
    );
}

#[test]
fn explicit_open_resume_clears_all_suppressions() {
    let seeded = seed_all();
    seeded.storage.clear_records(
        &[StorageCategory::Recents, StorageCategory::Session],
        true,
        &seeded.cache_dir,
    );
    assert!(!seeded.storage.write_allowed(StorageCategory::Recents));
    assert!(!seeded.storage.write_allowed(StorageCategory::Session));

    // open_documents(entry != "restore") resumes write-back (data-model §6).
    seeded.storage.resume_after_explicit_open();
    assert!(seeded.storage.write_allowed(StorageCategory::Recents));
    assert!(seeded.storage.write_allowed(StorageCategory::Session));
    assert!(seeded.storage.touch_recent("d-1", 400).saved);
}

#[test]
fn clear_cache_removes_files_and_reports_partial_failures() {
    let seeded = seed_all();
    // A directory at the rel_path cannot be deleted with `remove_file`.
    fs::create_dir_all(seeded.cache_dir.join("blocked")).unwrap();
    seeded
        .storage
        .upsert_cache_entry(&cache_entry("c-blocked", "blocked", 30))
        .unwrap();

    let results = seeded
        .storage
        .clear_records(&[StorageCategory::Cache], true, &seeded.cache_dir);
    assert_eq!(results[0].cleared, 2);
    let error = results[0].error.as_ref().expect("partial failure exposed");
    assert_eq!(error.code, "PS_IO_WRITE_FAILED");
    assert!(!seeded.cache_dir.join("remote-images/a.bin").exists());
    // The blocked row is kept for a retry, never reported as cleared.
    assert_eq!(seeded.storage.cache_count().unwrap(), 1);
}

#[test]
fn clear_never_touches_source_files() {
    let temp = TempDir::new().unwrap();
    let source_dir = temp.path().join("source");
    fs::create_dir_all(&source_dir).unwrap();
    let source_file = source_dir.join("document.md");
    fs::write(&source_file, "# original\n").unwrap();

    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    let cache_dir = temp.path().join("cache");
    fs::create_dir_all(&cache_dir).unwrap();
    cache_file(&cache_dir, "remote-images/a.bin", 4);
    storage
        .upsert_document(&document("d-1", &source_file.to_string_lossy()))
        .unwrap();
    storage.touch_recent("d-1", 1);
    storage.save_position("d-1", &anchor("hash-1"), 2);
    storage
        .upsert_cache_entry(&cache_entry("c-a", "remote-images/a.bin", 4))
        .unwrap();

    let results = storage.clear_records(
        &[
            StorageCategory::Recents,
            StorageCategory::Positions,
            StorageCategory::Session,
            StorageCategory::Cache,
            StorageCategory::Authorizations,
        ],
        true,
        &cache_dir,
    );
    assert!(results.iter().all(|result| result.error.is_none()));
    assert_eq!(fs::read(&source_file).unwrap(), b"# original\n");
    assert_eq!(fs::read_dir(&source_dir).unwrap().count(), 1);
}

#[test]
fn get_storage_overview_reports_per_category_usage() {
    let seeded = seed_all();
    let overview = seeded.storage.storage_overview(&seeded.cache_dir).unwrap();
    assert_eq!(overview.categories.len(), 6);
    let by_category = |category: StorageCategory| {
        overview
            .categories
            .iter()
            .find(|info| info.category == category)
            .unwrap()
    };
    assert_eq!(by_category(StorageCategory::Recents).count, 2);
    assert_eq!(by_category(StorageCategory::Positions).count, 1);
    assert_eq!(by_category(StorageCategory::Session).count, 5);
    assert_eq!(by_category(StorageCategory::Cache).count, 2);
    assert_eq!(by_category(StorageCategory::Cache).bytes, Some(30));
    assert_eq!(by_category(StorageCategory::Authorizations).count, 2);
    assert_eq!(by_category(StorageCategory::Logs).count, 0);
    assert!(overview.database_path.ends_with("paperstack.sqlite3"));
    assert_eq!(overview.cache_dir, seeded.cache_dir.display().to_string());
}
