//! Repository round-trips and cache LRU behavior (T-13; data-model §3–§7):
//! settings, recents (≤100), positions, session tabs, sidebar state,
//! authorizations (including the wp-08 registry persistence hook) and cache
//! metadata.

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::models::{
    AnchorRecord, GlobalSettings, GlobalSettingsPatch, GrantKind, GrantRecord, GrantScope,
    SessionTab, SourceRange, Theme,
};
use paperstack_lib::services::auth::AuthRegistry;
use paperstack_lib::services::paths::SystemPathProbe;
use paperstack_lib::services::storage::{
    CacheEntry, CacheEvictionReport, DocumentRecord, SidebarKind, Storage, DATABASE_FILE_NAME,
};
use tempfile::TempDir;

fn open_fixture() -> (TempDir, Storage) {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path()).unwrap();
    (temp, storage)
}

fn document(doc_id: &str, canonical_path: &str) -> DocumentRecord {
    DocumentRecord {
        doc_id: doc_id.to_owned(),
        canonical_path: canonical_path.to_owned(),
        display_name: canonical_path
            .rsplit('/')
            .next()
            .unwrap_or(canonical_path)
            .to_owned(),
        format: paperstack_lib::models::DocumentFormat::Markdown,
        encoding: paperstack_lib::models::TextEncoding::Utf8,
        content_hash: None,
        size_bytes: None,
        last_seen_at_ms: 1,
    }
}

fn anchor(version_hash: &str) -> AnchorRecord {
    AnchorRecord {
        version_hash: version_hash.to_owned(),
        heading_path: vec!["2. 方法".to_owned(), "2.1 数据".to_owned()],
        block_fingerprint: "fp1:0123456789abcdef".to_owned(),
        offset_ratio: 0.25,
        source_range: SourceRange {
            start_byte: 10,
            end_byte: 20,
        },
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

fn cache_file(cache_dir: &Path, rel_path: &str, bytes: usize) {
    let path = cache_dir.join(rel_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, vec![b'x'; bytes]).unwrap();
}

fn cache_entry(cache_key: &str, rel_path: &str, size: u64, access: i64) -> CacheEntry {
    CacheEntry {
        cache_key: cache_key.to_owned(),
        rel_path: rel_path.to_owned(),
        size_bytes: size,
        source_url_hash: Some("sha256:abc".to_owned()),
        created_at_ms: access,
        last_access_at_ms: access,
    }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

#[test]
fn settings_defaults_match_the_frozen_srs_values() {
    let (_temp, storage) = open_fixture();
    assert_eq!(storage.load_settings().unwrap(), GlobalSettings::default());
    assert!(storage.remember_records());
    assert_eq!(storage.settings_revision(), 0);
}

#[test]
fn settings_round_trip_persists_across_reopen() {
    let temp = TempDir::new().unwrap();
    {
        let storage = Storage::open(temp.path()).unwrap();
        let patch = GlobalSettingsPatch {
            theme: Some(Theme::Dark),
            font_size_px: Some(20),
            remember_records: Some(false),
            ..Default::default()
        };
        let updated = storage.update_settings(&patch, 1_000).unwrap();
        assert_eq!(updated.theme, Theme::Dark);
        assert_eq!(updated.font_size_px, 20);
        assert!(!updated.remember_records);
        assert_eq!(storage.settings_revision(), 1);
    }
    let storage = Storage::open(temp.path()).unwrap();
    let settings = storage.load_settings().unwrap();
    assert_eq!(settings.theme, Theme::Dark);
    assert_eq!(settings.font_size_px, 20);
    assert!(!settings.remember_records);
    assert!(!storage.remember_records());
}

#[test]
fn settings_out_of_range_values_keep_the_previous_value() {
    let (_temp, storage) = open_fixture();
    let invalid = GlobalSettingsPatch {
        font_size_px: Some(99),
        line_height: Some(0.5),
        max_content_width_px: Some(2_000),
        ..Default::default()
    };
    let updated = storage.update_settings(&invalid, 1).unwrap();
    assert_eq!(updated.font_size_px, 17);
    assert_eq!(updated.line_height, 1.8);
    assert_eq!(updated.max_content_width_px, 760);

    let valid = GlobalSettingsPatch {
        font_size_px: Some(24),
        line_height: Some(2.2),
        max_content_width_px: Some(560),
        ..Default::default()
    };
    let updated = storage.update_settings(&valid, 2).unwrap();
    assert_eq!(updated.font_size_px, 24);
    assert_eq!(updated.line_height, 2.2);
    assert_eq!(updated.max_content_width_px, 560);
}

#[test]
fn remember_records_false_blocks_record_writes_independently_of_suppression() {
    let (_temp, storage) = open_fixture();
    storage
        .upsert_document(&document("d-1", "/notes/a.md"))
        .unwrap();
    let disable = GlobalSettingsPatch {
        remember_records: Some(false),
        ..Default::default()
    };
    storage.update_settings(&disable, 1).unwrap();
    assert!(!storage.write_allowed(paperstack_lib::models::StorageCategory::Recents));

    let touch = storage.touch_recent("d-1", 10);
    assert!(!touch.saved);
    assert!(touch.error.is_none());
    assert_eq!(storage.recents_count().unwrap(), 0);

    // Resuming does not override the user preference (INV-WB-04).
    storage.resume_recording(None);
    assert!(!storage.write_allowed(paperstack_lib::models::StorageCategory::Recents));

    let enable = GlobalSettingsPatch {
        remember_records: Some(true),
        ..Default::default()
    };
    storage.update_settings(&enable, 2).unwrap();
    assert!(storage.touch_recent("d-1", 11).saved);
    assert_eq!(storage.recents_count().unwrap(), 1);
}

// ---------------------------------------------------------------------------
// Recents
// ---------------------------------------------------------------------------

#[test]
fn recents_are_capped_at_100_and_ordered_newest_first() {
    let (temp, storage) = open_fixture();
    for index in 0..105 {
        let doc_id = format!("d-{index:04}");
        let path = temp.path().join(format!("doc-{index:04}.md"));
        storage
            .upsert_document(&document(&doc_id, &path.to_string_lossy()))
            .unwrap();
        assert!(storage.touch_recent(&doc_id, 1_000 + index).saved);
    }
    let recents = storage.list_recents(&SystemPathProbe).unwrap();
    assert_eq!(recents.len(), 100);
    assert_eq!(recents[0].doc_id, "d-0104");
    assert_eq!(recents[0].opened_at_ms, 1_104);
    assert_eq!(recents[99].doc_id, "d-0005");
    assert!(!recents.iter().any(|entry| entry.doc_id == "d-0000"));
    assert_eq!(storage.recents_count().unwrap(), 100);
}

#[test]
fn touch_recent_refreshes_the_last_known_path() {
    let (_temp, storage) = open_fixture();
    storage
        .upsert_document(&document("d-1", "/notes/old-name.md"))
        .unwrap();
    storage.touch_recent("d-1", 1);
    storage
        .upsert_document(&document("d-1", "/notes/new-name.md"))
        .unwrap();
    storage.touch_recent("d-1", 2);
    let recents = storage.list_recents(&SystemPathProbe).unwrap();
    assert_eq!(recents.len(), 1);
    assert_eq!(recents[0].canonical_path, "/notes/new-name.md");
    assert_eq!(recents[0].opened_at_ms, 2);
}

#[test]
fn touch_recent_rejects_an_unknown_document() {
    let (_temp, storage) = open_fixture();
    let result = storage.touch_recent("d-missing", 1);
    assert!(!result.saved);
    assert_eq!(
        result.error.as_ref().map(|error| error.code.as_str()),
        Some("PS_DB_FAILURE")
    );
    assert_eq!(storage.recents_count().unwrap(), 0);
}

#[test]
fn list_recents_reports_availability_from_the_read_time_recheck() {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    let existing = temp.path().join("present.md");
    fs::write(&existing, "# present\n").unwrap();
    let missing = temp.path().join("missing.md");
    storage
        .upsert_document(&document("d-present", &existing.to_string_lossy()))
        .unwrap();
    storage
        .upsert_document(&document("d-missing", &missing.to_string_lossy()))
        .unwrap();
    storage.touch_recent("d-present", 2);
    storage.touch_recent("d-missing", 1);
    let recents = storage.list_recents(&SystemPathProbe).unwrap();
    assert_eq!(recents.len(), 2);
    assert!(recents[0].available);
    assert!(!recents[1].available);
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

#[test]
fn positions_round_trip_the_anchor_record() {
    let (_temp, storage) = open_fixture();
    storage
        .upsert_document(&document("d-1", "/notes/a.md"))
        .unwrap();
    let saved = storage.save_position("d-1", &anchor("hash-1"), 42);
    assert!(saved.saved);
    let loaded = storage.load_position("d-1").unwrap().unwrap();
    assert_eq!(loaded.doc_id, "d-1");
    assert_eq!(loaded.updated_at_ms, 42);
    assert_eq!(loaded.anchor, anchor("hash-1"));
}

#[test]
fn save_position_requires_a_known_document_and_load_returns_none_otherwise() {
    let (_temp, storage) = open_fixture();
    let result = storage.save_position("d-missing", &anchor("hash-1"), 1);
    assert!(!result.saved);
    assert_eq!(
        result.error.as_ref().map(|error| error.code.as_str()),
        Some("PS_DB_FAILURE")
    );
    assert!(storage.load_position("d-missing").unwrap().is_none());
}

// ---------------------------------------------------------------------------
// Session tabs and sidebar state
// ---------------------------------------------------------------------------

#[test]
fn session_tabs_round_trip_with_order_and_active_tab() {
    let (_temp, storage) = open_fixture();
    storage
        .upsert_document(&document("d-1", "/notes/a.md"))
        .unwrap();
    storage
        .upsert_document(&document("d-2", "/notes/b.md"))
        .unwrap();
    let saved = storage.save_session_tabs(
        &[tab("t-2", "d-2", 2, true), tab("t-1", "d-1", 1, false)],
        500,
    );
    assert!(saved.saved);
    let snapshot = storage.load_session_snapshot().unwrap().unwrap();
    let order: Vec<&str> = snapshot
        .tabs
        .iter()
        .map(|tab| tab.tab_id.as_str())
        .collect();
    assert_eq!(order, ["t-1", "t-2"]);
    assert_eq!(snapshot.active_tab_id.as_deref(), Some("t-2"));
    assert!(!snapshot.tabs[0].is_active);
    assert!(snapshot.tabs[1].is_active);
    assert_eq!(snapshot.saved_at_ms, 500);
}

#[test]
fn session_snapshot_is_none_before_the_first_save() {
    let (_temp, storage) = open_fixture();
    assert!(storage.load_session_snapshot().unwrap().is_none());
}

#[test]
fn sidebar_state_round_trip_and_size_limit() {
    let (_temp, storage) = open_fixture();
    let state = r#"{"expanded":["/notes"],"scrollTop":12}"#;
    assert!(
        storage
            .save_sidebar_state(SidebarKind::Directory, "/notes", state, 7)
            .saved
    );
    assert_eq!(
        storage
            .load_sidebar_state(SidebarKind::Directory, "/notes")
            .unwrap()
            .as_deref(),
        Some(state)
    );
    // 65KiB exceeds the 64KiB cap (data-model §2).
    let oversized = format!(r#"{{"blob":"{}"}}"#, "x".repeat(65 * 1024));
    let result = storage.save_sidebar_state(SidebarKind::Directory, "/notes", &oversized, 8);
    assert!(!result.saved);
    assert_eq!(
        result.error.as_ref().map(|error| error.code.as_str()),
        Some("PS_DB_FAILURE")
    );
    assert_eq!(
        storage
            .load_sidebar_state(SidebarKind::Directory, "/notes")
            .unwrap()
            .as_deref(),
        Some(state)
    );
    // Invalid JSON is rejected as well.
    let invalid = storage.save_sidebar_state(SidebarKind::Document, "d-1", "not json", 9);
    assert!(!invalid.saved);
}

// ---------------------------------------------------------------------------
// Authorizations
// ---------------------------------------------------------------------------

fn file_grant(id: &str, path: &str, scope: GrantScope) -> GrantRecord {
    GrantRecord {
        grant_id: id.to_owned(),
        kind: GrantKind::File,
        scope,
        canonical_path: Some(path.to_owned()),
        origins: None,
        doc_id: None,
        granted_at_ms: 100,
    }
}

fn remote_grant(id: &str, doc_id: &str) -> GrantRecord {
    GrantRecord {
        grant_id: id.to_owned(),
        kind: GrantKind::Remote,
        scope: GrantScope::Session,
        canonical_path: None,
        origins: Some(vec!["https://example.com".to_owned()]),
        doc_id: Some(doc_id.to_owned()),
        granted_at_ms: 200,
    }
}

#[test]
fn authorizations_round_trip_and_session_purge() {
    let (_temp, storage) = open_fixture();
    let file = file_grant("g-file", "/notes/a.md", GrantScope::Persistent);
    let remote = remote_grant("g-remote", "d-1");
    storage.upsert_grant(&file).unwrap();
    storage.upsert_grant(&remote).unwrap();
    let mut loaded = storage.load_grants().unwrap();
    loaded.sort_by(|a, b| a.grant_id.cmp(&b.grant_id));
    assert_eq!(loaded, vec![file.clone(), remote]);

    // Startup removes session rows only (data-model §3.2).
    assert_eq!(storage.purge_session_grants().unwrap(), 1);
    assert_eq!(storage.load_grants().unwrap(), vec![file.clone()]);

    storage.delete_grant(&file.grant_id).unwrap();
    assert!(storage.load_grants().unwrap().is_empty());
}

#[test]
fn authorization_persistence_serves_the_wp08_auth_registry() {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    let granted_file = temp.path().join("granted.md");
    fs::write(&granted_file, "# g\n").unwrap();
    let canonical = fs::canonicalize(&granted_file).unwrap();

    let mut registry = AuthRegistry::with_persistence(Box::new(storage.clone()));
    let grant = registry.grant_file(&canonical, 10).unwrap();

    let mut restored = AuthRegistry::with_persistence(Box::new(storage.clone()));
    restored.load_grants(storage.load_grants().unwrap());
    assert_eq!(restored.list(), vec![grant.clone()]);

    restored.revoke(&grant.grant_id).unwrap();
    assert!(storage.load_grants().unwrap().is_empty());
}

// ---------------------------------------------------------------------------
// Cache metadata and LRU
// ---------------------------------------------------------------------------

#[test]
fn cache_metadata_round_trip_and_touch() {
    let (_temp, storage) = open_fixture();
    let entry = cache_entry("c-1", "remote-images/a.png", 128, 10);
    storage.upsert_cache_entry(&entry).unwrap();
    assert_eq!(storage.cache_entry("c-1").unwrap(), Some(entry.clone()));
    assert_eq!(storage.cache_total_bytes().unwrap(), 128);
    assert_eq!(storage.cache_count().unwrap(), 1);

    assert_eq!(storage.touch_cache_entry("c-1", 99).unwrap(), 1);
    assert_eq!(
        storage
            .cache_entry("c-1")
            .unwrap()
            .unwrap()
            .last_access_at_ms,
        99
    );
    assert_eq!(storage.touch_cache_entry("c-missing", 99).unwrap(), 0);
}

#[test]
fn cache_lru_evicts_the_oldest_files_and_metadata() {
    let temp = TempDir::new().unwrap();
    let cache_dir = temp.path().join("cache");
    fs::create_dir_all(&cache_dir).unwrap();
    cache_file(&cache_dir, "remote-images/a.bin", 100);
    cache_file(&cache_dir, "remote-images/b.bin", 200);
    cache_file(&cache_dir, "remote-images/c.bin", 300);

    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-a", "remote-images/a.bin", 100, 3))
        .unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-b", "remote-images/b.bin", 200, 1))
        .unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-c", "remote-images/c.bin", 300, 2))
        .unwrap();

    let report = storage.enforce_cache_limit(&cache_dir, 350).unwrap();
    assert_eq!(
        report,
        CacheEvictionReport {
            evicted: 2,
            freed_bytes: 500,
            failures: 0,
            unsafe_paths: 0,
        }
    );
    assert!(!cache_dir.join("remote-images/b.bin").exists());
    assert!(!cache_dir.join("remote-images/c.bin").exists());
    assert!(cache_dir.join("remote-images/a.bin").exists());
    assert_eq!(storage.cache_count().unwrap(), 1);
    assert_eq!(storage.cache_total_bytes().unwrap(), 100);
}

#[test]
fn cache_lru_keeps_rows_for_files_that_cannot_be_deleted() {
    let temp = TempDir::new().unwrap();
    let cache_dir = temp.path().join("cache");
    fs::create_dir_all(cache_dir.join("blocked")).unwrap();

    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-blocked", "blocked", 500, 1))
        .unwrap();
    let report = storage.enforce_cache_limit(&cache_dir, 1).unwrap();
    assert_eq!(report.failures, 1);
    assert_eq!(report.evicted, 0);
    // The row is kept so the next pass can retry (data-model §7).
    assert_eq!(storage.cache_count().unwrap(), 1);
}

#[test]
fn cache_lru_drops_unsafe_metadata_without_touching_outside_files() {
    let temp = TempDir::new().unwrap();
    let cache_dir = temp.path().join("cache");
    fs::create_dir_all(&cache_dir).unwrap();
    let outside = temp.path().join("escape.bin");
    fs::write(&outside, b"outside").unwrap();

    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-escape", "../escape.bin", 500, 1))
        .unwrap();
    let report = storage.enforce_cache_limit(&cache_dir, 1).unwrap();
    assert_eq!(report.unsafe_paths, 1);
    assert_eq!(report.evicted, 1);
    assert!(outside.exists());
    assert_eq!(storage.cache_count().unwrap(), 0);
}

#[test]
fn remove_cache_entry_deletes_file_and_metadata_and_reports_unknown_keys() {
    let temp = TempDir::new().unwrap();
    let cache_dir = temp.path().join("cache");
    cache_file(&cache_dir, "remote-images/a.bin", 64);
    let storage = Storage::open(temp.path().join("appdata")).unwrap();
    storage
        .upsert_cache_entry(&cache_entry("c-a", "remote-images/a.bin", 64, 1))
        .unwrap();

    assert!(storage.remove_cache_entry("c-a", &cache_dir).unwrap());
    assert!(!cache_dir.join("remote-images/a.bin").exists());
    assert_eq!(storage.cache_count().unwrap(), 0);
    assert!(!storage.remove_cache_entry("c-a", &cache_dir).unwrap());
}

#[test]
fn database_file_name_helper_points_at_the_app_data_directory() {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path()).unwrap();
    assert_eq!(
        storage.database_path(),
        PathBuf::from(temp.path()).join(DATABASE_FILE_NAME)
    );
}
