//! `read_document` semantics and the §7.4 stability protocol (T-09):
//! validation-cache hits for initial/restore, stable refresh (one-shot writer
//! retry, continuous writer → `PS_IO_CHANGED`), relink branches and the
//! >50MiB (source-only) full-read rejection.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::{ReadPurpose, RelinkStatus};
use paperstack_lib::services::files::{FilesConfig, FilesService};
use tempfile::TempDir;

fn path_str(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn fast_config() -> FilesConfig {
    FilesConfig {
        stability_window: Duration::from_millis(80),
        stability_attempts: 3,
        ..FilesConfig::default()
    }
}

#[test]
fn initial_read_hits_the_validation_snapshot_cache() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# version one\n").unwrap();

    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&path)).unwrap();
    let first = opened.snapshot.unwrap();

    // The file changes after open; `initial` must still serve the validated
    // snapshot (contracts §2.1: initial|restore may hit the cache).
    fs::write(&path, "# version two (longer)\n").unwrap();
    let second = service
        .read_document(&opened.doc_id, ReadPurpose::Initial)
        .unwrap();
    assert_eq!(second.text, first.text);
    assert_eq!(second.version.content_hash, first.version.content_hash);
}

#[test]
fn refresh_stably_reads_the_new_disk_version() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# version one\n").unwrap();

    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&path)).unwrap();
    fs::write(&path, "# version two\n").unwrap();

    let snapshot = service
        .read_document(&opened.doc_id, ReadPurpose::Refresh)
        .unwrap();
    let raw = fs::read(&path).unwrap();
    assert_eq!(snapshot.text, "# version two\n");
    assert_eq!(
        snapshot.version.content_hash,
        paperstack_lib::services::files::sha256_hex(&raw)
    );
    assert_eq!(
        service
            .document(&opened.doc_id)
            .unwrap()
            .version()
            .content_hash,
        snapshot.version.content_hash
    );
}

#[test]
fn refresh_on_a_missing_file_reports_not_found() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# gone soon\n").unwrap();

    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&path)).unwrap();
    fs::remove_file(&path).unwrap();
    let error = service
        .read_document(&opened.doc_id, ReadPurpose::Refresh)
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoNotFound);
}

#[test]
fn refresh_retries_a_one_shot_writer_and_returns_the_stable_version() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# version one\n").unwrap();

    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&path)).unwrap();

    let writer_path = path.clone();
    let writer = thread::spawn(move || {
        thread::sleep(Duration::from_millis(30));
        fs::write(&writer_path, "# version two\n").unwrap();
    });
    let snapshot = service
        .read_document(&opened.doc_id, ReadPurpose::Refresh)
        .unwrap();
    writer.join().unwrap();

    assert_eq!(snapshot.text, "# version two\n");
    assert_eq!(
        snapshot.version.content_hash,
        paperstack_lib::services::files::sha256_hex(b"# version two\n")
    );
}

#[test]
fn refresh_of_a_continuously_rewritten_file_reports_io_changed() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# version 0\n").unwrap();

    let config = FilesConfig {
        stability_window: Duration::from_millis(60),
        stability_attempts: 2,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    let opened = service.open_document(&path_str(&path)).unwrap();

    let stop = Arc::new(AtomicBool::new(false));
    let writer_path = path.clone();
    let writer_stop = Arc::clone(&stop);
    let writer = thread::spawn(move || {
        let mut counter = 0u64;
        while !writer_stop.load(Ordering::Relaxed) {
            counter += 1;
            fs::write(&writer_path, format!("# version {counter} 中\n")).unwrap();
            thread::sleep(Duration::from_millis(2));
        }
    });

    let result = service.read_document(&opened.doc_id, ReadPurpose::Refresh);
    stop.store(true, Ordering::Relaxed);
    writer.join().unwrap();

    let error = result.expect_err("continuously unstable file must not report success");
    assert_eq!(error.code(), ErrorCode::IoChanged);
}

#[test]
fn source_only_document_rejects_full_reads_with_limit_size() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("large.md");
    fs::write(&path, "x".repeat(4096)).unwrap();

    let config = FilesConfig {
        read_limit_bytes: 1024,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    let opened = service.open_document(&path_str(&path)).unwrap();
    assert!(opened.source_only);
    assert!(opened.snapshot.is_none());

    for purpose in [
        ReadPurpose::Initial,
        ReadPurpose::Refresh,
        ReadPurpose::Relink,
    ] {
        let error = service.read_document(&opened.doc_id, purpose).unwrap_err();
        assert_eq!(error.code(), ErrorCode::LimitSize);
    }
}

#[test]
fn snapshot_cache_evicts_beyond_capacity_and_reloads_from_disk() {
    let temp = TempDir::new().unwrap();
    let mut service = FilesService::with_config(FilesConfig {
        snapshot_cache_capacity: 2,
        ..FilesConfig::default()
    });
    let mut ids = Vec::new();
    for name in ["a.md", "b.md", "c.md"] {
        let path = temp.path().join(name);
        fs::write(&path, format!("# {name}\n")).unwrap();
        ids.push(service.open_document(&path_str(&path)).unwrap().doc_id);
    }
    assert_eq!(service.cached_snapshot_count(), 2);

    // "a" was evicted; initial must rebuild from disk after validating the
    // registered hash (it is unchanged, so this succeeds).
    let snapshot = service
        .read_document(&ids[0], ReadPurpose::Initial)
        .unwrap();
    assert_eq!(snapshot.text, "# a.md\n");
    assert_eq!(service.cached_snapshot_count(), 2);
}

#[test]
fn relink_with_identical_bytes_reassociates_the_same_doc_id() {
    let temp = TempDir::new().unwrap();
    let original = temp.path().join("original.md");
    let moved = temp.path().join("moved.md");
    fs::write(&original, "# same bytes\n").unwrap();
    fs::copy(&original, &moved).unwrap();

    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&original)).unwrap();
    let relinked = service
        .relink_document(&opened.doc_id, &path_str(&moved))
        .unwrap();

    assert_eq!(relinked.status, RelinkStatus::Reassociated);
    assert_eq!(relinked.snapshot.doc_id, opened.doc_id);
    assert_eq!(
        relinked.snapshot.identity.content_hash,
        opened.identity.content_hash
    );
    assert_eq!(relinked.snapshot.text, "# same bytes\n");
    assert_eq!(
        service.document(&opened.doc_id).unwrap().canonical_path(),
        relinked.snapshot.identity.canonical_path
    );
}

#[test]
fn relink_with_different_bytes_becomes_a_new_version_of_the_same_doc() {
    let temp = TempDir::new().unwrap();
    let original = temp.path().join("original.md");
    let moved = temp.path().join("moved.md");
    fs::write(&original, "# old content\n").unwrap();
    fs::write(&moved, "# 不同的内容\n").unwrap();

    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&original)).unwrap();
    let relinked = service
        .relink_document(&opened.doc_id, &path_str(&moved))
        .unwrap();

    assert_eq!(relinked.status, RelinkStatus::NewVersion);
    assert_eq!(relinked.snapshot.doc_id, opened.doc_id);
    assert_ne!(
        relinked.snapshot.identity.content_hash,
        opened.identity.content_hash
    );
    assert_eq!(relinked.snapshot.text, "# 不同的内容\n");
}

#[test]
fn relink_validates_the_new_path() {
    let temp = TempDir::new().unwrap();
    let original = temp.path().join("original.md");
    fs::write(&original, "# old\n").unwrap();
    let mut service = FilesService::with_config(fast_config());
    let opened = service.open_document(&path_str(&original)).unwrap();

    let missing = temp.path().join("missing.md");
    assert_eq!(
        service
            .relink_document(&opened.doc_id, &path_str(&missing))
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );

    let text = temp.path().join("target.txt");
    fs::write(&text, "# txt\n").unwrap();
    assert_eq!(
        service
            .relink_document(&opened.doc_id, &path_str(&text))
            .unwrap_err()
            .code(),
        ErrorCode::FormatUnsupported
    );
}

#[test]
fn relink_to_a_path_of_another_document_is_an_internal_invariant_violation() {
    let temp = TempDir::new().unwrap();
    let first_path = temp.path().join("first.md");
    let second_path = temp.path().join("second.md");
    fs::write(&first_path, "# first\n").unwrap();
    fs::write(&second_path, "# second\n").unwrap();

    let mut service = FilesService::with_config(fast_config());
    let first = service.open_document(&path_str(&first_path)).unwrap();
    service.open_document(&path_str(&second_path)).unwrap();

    assert_eq!(
        service
            .relink_document(&first.doc_id, &path_str(&second_path))
            .unwrap_err()
            .code(),
        ErrorCode::Internal
    );
}

#[test]
fn unknown_doc_ids_are_not_found() {
    let mut service = FilesService::new();
    assert_eq!(
        service
            .read_document("d-0000000000000000", ReadPurpose::Initial)
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );
}
