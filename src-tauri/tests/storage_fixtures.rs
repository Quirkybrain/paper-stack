//! Persisted anchor/position record fixture (T-13; data-model §3.3, contracts
//! §3.4): guards the serialized `PositionRecord` shape against drift
//! (`fixtures/storage/anchor-record.example.json`) and proves it survives a
//! storage round-trip.

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::models::{DocumentFormat, PositionRecord, TextEncoding};
use paperstack_lib::services::storage::{DocumentRecord, Storage};
use tempfile::TempDir;

fn fixture_path() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/storage/anchor-record.example.json")
}

fn read_fixture() -> (String, PositionRecord) {
    let raw = fs::read_to_string(fixture_path()).expect("anchor fixture must exist");
    let record: PositionRecord =
        serde_json::from_str(&raw).expect("fixture must deserialize into PositionRecord");
    (raw, record)
}

#[test]
fn anchor_record_fixture_matches_the_serialized_contract_shape() {
    let (raw, record) = read_fixture();

    assert!(record.doc_id.starts_with("d-"));
    assert_eq!(record.doc_id.len(), 18);
    assert_eq!(record.anchor.version_hash.len(), 64);
    assert!(record
        .anchor
        .version_hash
        .chars()
        .all(|c| c.is_ascii_hexdigit()));
    assert_eq!(
        record.anchor.heading_path,
        vec!["2. 方法".to_owned(), "2.1 数据".to_owned()]
    );
    assert!(record.anchor.block_fingerprint.starts_with("fp1:"));
    assert_eq!(record.anchor.block_fingerprint.len(), 20);
    assert!((0.0..=1.0).contains(&record.anchor.offset_ratio));
    assert!(record.anchor.source_range.start_byte < record.anchor.source_range.end_byte);
    assert!(record.updated_at_ms > 0);

    // Semantic (order-insensitive) round-trip: the serialized record must keep
    // exactly the fixture fields and camelCase names (contracts §1.3/§3.4).
    let original: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let serialized: serde_json::Value = serde_json::to_value(&record).unwrap();
    assert_eq!(serialized, original);
}

#[test]
fn anchor_record_fixture_survives_a_storage_round_trip() {
    let (_raw, record) = read_fixture();
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path()).unwrap();
    storage
        .upsert_document(&DocumentRecord {
            doc_id: record.doc_id.clone(),
            canonical_path: "/notes/示例.md".to_owned(),
            display_name: "示例.md".to_owned(),
            format: DocumentFormat::Markdown,
            encoding: TextEncoding::Utf8,
            content_hash: Some(record.anchor.version_hash.clone()),
            size_bytes: Some(8_192),
            last_seen_at_ms: record.updated_at_ms,
        })
        .unwrap();

    let saved = storage.save_position(&record.doc_id, &record.anchor, record.updated_at_ms);
    assert!(saved.saved);
    let loaded = storage.load_position(&record.doc_id).unwrap().unwrap();
    assert_eq!(loaded, record);
}
