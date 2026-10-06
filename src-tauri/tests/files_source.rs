//! Source view services (T-10): `get_source_info`, `read_source_window` and
//! `search_source` line boundaries, windowed/streamed reads, literal
//! case-folded search, explicit incompleteness and version validation.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::{ReadSourceWindowRequest, SearchSourceRequest};
use paperstack_lib::services::files::{FilesConfig, FilesService};
use tempfile::TempDir;

fn encoding_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/encoding")
}

fn path_str(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn window_request(doc_id: &str, start_line: u64, max_lines: u64) -> ReadSourceWindowRequest {
    ReadSourceWindowRequest {
        doc_id: doc_id.to_owned(),
        start_line,
        max_lines,
    }
}

fn search_request(
    doc_id: &str,
    query: &str,
    case_sensitive: bool,
    max_results: u64,
) -> SearchSourceRequest {
    SearchSourceRequest {
        doc_id: doc_id.to_owned(),
        query: query.to_owned(),
        case_sensitive,
        max_results,
    }
}

#[test]
fn source_info_reports_registered_version_and_total_lines() {
    let mut service = FilesService::new();
    let path = encoding_dir().join("crlf.md");
    let opened = service.open_document(&path_str(&path)).unwrap();
    let info = service.get_source_info(&opened.doc_id).unwrap();
    assert_eq!(info.doc_id, opened.doc_id);
    assert_eq!(info.total_lines, 3);
    assert_eq!(
        info.version.content_hash,
        opened.snapshot.as_ref().unwrap().version.content_hash
    );
}

#[test]
fn source_window_slices_lines_and_preserves_crlf() {
    let mut service = FilesService::new();
    let path = encoding_dir().join("crlf.md");
    let opened = service.open_document(&path_str(&path)).unwrap();

    let first = service
        .read_source_window(&window_request(&opened.doc_id, 1, 2))
        .unwrap();
    assert_eq!(first.start_line, 1);
    assert_eq!(first.end_line, 2);
    assert_eq!(first.text, "第一行\r\nsecond line");
    assert!(!first.eof);

    let second = service
        .read_source_window(&window_request(&opened.doc_id, 2, 10))
        .unwrap();
    assert_eq!(second.start_line, 2);
    assert_eq!(second.end_line, 3);
    assert_eq!(second.text, "second line\r\nthird");
    assert!(second.eof);
}

#[test]
fn source_window_handles_cjk_and_emoji_boundaries() {
    let mut service = FilesService::new();
    let path = encoding_dir().join("utf8-cn-emoji.md");
    let text = fs::read_to_string(&path).unwrap();
    let lines: Vec<&str> = text.split('\n').collect();
    let opened = service.open_document(&path_str(&path)).unwrap();

    let window = service
        .read_source_window(&window_request(&opened.doc_id, 3, 2))
        .unwrap();
    assert_eq!(window.text, lines[2..4].join("\n"));
    assert_eq!(window.end_line, 4);
    assert!(!window.eof);

    let window = service
        .read_source_window(&window_request(&opened.doc_id, 4, 1))
        .unwrap();
    assert_eq!(window.text, lines[3]);
}

#[test]
fn source_window_clamps_beyond_end_of_file() {
    let mut service = FilesService::new();
    let path = encoding_dir().join("crlf.md");
    let opened = service.open_document(&path_str(&path)).unwrap();
    let window = service
        .read_source_window(&window_request(&opened.doc_id, 99, 5))
        .unwrap();
    assert_eq!(window.start_line, 3);
    assert_eq!(window.end_line, 3);
    assert_eq!(window.text, "third");
    assert!(window.eof);
}

#[test]
fn source_window_rejects_out_of_contract_requests() {
    let mut service = FilesService::new();
    let path = encoding_dir().join("crlf.md");
    let opened = service.open_document(&path_str(&path)).unwrap();
    for (start, max) in [(0, 10), (1, 0), (1, 2001)] {
        let error = service
            .read_source_window(&window_request(&opened.doc_id, start, max))
            .unwrap_err();
        assert_eq!(error.code(), ErrorCode::Internal, "start={start} max={max}");
    }
}

#[test]
fn source_window_does_not_read_a_new_disk_version() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# one\ntwo\n").unwrap();

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();
    fs::write(&path, "# changed\ncompletely different\n").unwrap();

    let info = service.get_source_info(&opened.doc_id).unwrap();
    assert_eq!(
        info.version.content_hash,
        opened.snapshot.as_ref().unwrap().version.content_hash
    );
    let window = service
        .read_source_window(&window_request(&opened.doc_id, 1, 2))
        .unwrap();
    assert_eq!(window.text, "# one\ntwo");
}

#[test]
fn source_only_windows_stream_lines_from_disk() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("large.md");
    let lines: Vec<String> = (0..200).map(|index| format!("line-{index:03}")).collect();
    let text = lines.join("\n");
    assert!(text.len() > 1024);
    fs::write(&path, &text).unwrap();

    let config = FilesConfig {
        read_limit_bytes: 1024,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    let opened = service.open_document(&path_str(&path)).unwrap();
    assert!(opened.source_only);

    let info = service.get_source_info(&opened.doc_id).unwrap();
    assert_eq!(info.total_lines, 200);

    let window = service
        .read_source_window(&window_request(&opened.doc_id, 195, 10))
        .unwrap();
    assert_eq!(window.start_line, 195);
    assert_eq!(window.end_line, 200);
    assert_eq!(window.text, lines[194..200].join("\n"));
    assert!(window.eof);

    let first = service
        .read_source_window(&window_request(&opened.doc_id, 1, 3))
        .unwrap();
    assert_eq!(first.text, lines[0..3].join("\n"));
    assert!(!first.eof);
}

#[test]
fn window_after_cache_eviction_reports_changed_content() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "# one\n").unwrap();
    let other = temp.path().join("other.md");
    fs::write(&other, "# other\n").unwrap();

    let mut service = FilesService::with_config(FilesConfig {
        snapshot_cache_capacity: 1,
        ..FilesConfig::default()
    });
    let opened = service.open_document(&path_str(&path)).unwrap();
    service.open_document(&path_str(&other)).unwrap();
    assert_eq!(service.cached_snapshot_count(), 1);

    // Cache miss, file unchanged: the registered version is reloaded.
    let window = service
        .read_source_window(&window_request(&opened.doc_id, 1, 1))
        .unwrap();
    assert_eq!(window.text, "# one");

    // Evict again, then change the bytes (same size): hash mismatch.
    service.open_document(&path_str(&other)).unwrap();
    fs::write(&path, "# two\n").unwrap();
    let error = service
        .read_source_window(&window_request(&opened.doc_id, 1, 1))
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoChanged);
}

#[test]
fn search_is_literal_and_case_foldable() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("search.md");
    let text = "# Title\n\nHello world, hello 中文。\nSecond Hello line\n";
    fs::write(&path, text).unwrap();

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();

    let sensitive = service
        .search_source(&search_request(&opened.doc_id, "Hello", true, 100))
        .unwrap();
    assert!(sensitive.complete);
    assert_eq!(sensitive.matches.len(), 2);
    assert_eq!(sensitive.scanned_bytes, text.len() as u64);
    assert_eq!(sensitive.total_bytes, text.len() as u64);
    for found in &sensitive.matches {
        assert_eq!(
            &text[found.start_byte as usize..found.end_byte as usize],
            "Hello"
        );
    }
    assert_eq!(sensitive.matches[0].line_number, 3);
    assert_eq!(sensitive.matches[1].line_number, 4);

    let insensitive = service
        .search_source(&search_request(&opened.doc_id, "hello", false, 100))
        .unwrap();
    assert_eq!(insensitive.matches.len(), 3);
    let first = &insensitive.matches[0];
    assert_eq!(
        &text[first.start_byte as usize..first.end_byte as usize],
        "Hello"
    );

    let cjk = service
        .search_source(&search_request(&opened.doc_id, "中文", false, 100))
        .unwrap();
    assert_eq!(cjk.matches.len(), 1);
    assert_eq!(cjk.matches[0].start_byte, text.find("中文").unwrap() as u64);
}

#[test]
fn search_case_fold_maps_offsets_to_original_bytes() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("fold.md");
    // U+0130 folds to "i" + U+0307 (2 original bytes -> 3 folded bytes).
    let text = "İstanbul İzmir\n";
    fs::write(&path, text).unwrap();

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();

    let sensitive = service
        .search_source(&search_request(&opened.doc_id, "i", true, 100))
        .unwrap();
    // The only plain ASCII "i" is the last letter of "İzmir".
    assert_eq!(sensitive.matches.len(), 1);
    assert_eq!(sensitive.matches[0].start_byte, 14);
    assert_eq!(sensitive.matches[0].end_byte, 15);

    let insensitive = service
        .search_source(&search_request(&opened.doc_id, "i", false, 100))
        .unwrap();
    assert_eq!(insensitive.matches.len(), 3);
    let ranges: Vec<(u64, u64)> = insensitive
        .matches
        .iter()
        .map(|found| (found.start_byte, found.end_byte))
        .collect();
    // U+0130 folds to "i" + U+0307: a folded-byte match maps back to the
    // whole 2-byte original character.
    assert_eq!(ranges, vec![(0, 2), (10, 12), (14, 15)]);
    assert_eq!(&text[0..2], "İ");
    assert_eq!(&text[10..12], "İ");
    assert_eq!(&text[14..15], "i");
}

#[test]
fn search_max_results_reports_an_incomplete_scan() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("many.md");
    fs::write(&path, "a a a a\n").unwrap();

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();
    let result = service
        .search_source(&search_request(&opened.doc_id, "a", true, 2))
        .unwrap();
    assert_eq!(result.matches.len(), 2);
    assert!(
        !result.complete,
        "capped results must not claim completeness"
    );
    assert!(result.scanned_bytes <= result.total_bytes);
}

#[test]
fn search_byte_budget_reports_an_incomplete_scan_honestly() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("budget.md");
    fs::write(&path, "0123456789abcdefghij").unwrap();

    let config = FilesConfig {
        search_budget_bytes: 10,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    let opened = service.open_document(&path_str(&path)).unwrap();

    let result = service
        .search_source(&search_request(&opened.doc_id, "abcdef", true, 100))
        .unwrap();
    assert!(result.matches.is_empty());
    assert!(!result.complete);
    assert_eq!(result.scanned_bytes, 10);
    assert_eq!(result.total_bytes, 20);

    let within = service
        .search_source(&search_request(&opened.doc_id, "234", true, 100))
        .unwrap();
    assert_eq!(within.matches.len(), 1);
    assert!(!within.complete);
}

#[test]
fn search_empty_query_is_a_complete_empty_result() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "content\n").unwrap();
    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();
    let result = service
        .search_source(&search_request(&opened.doc_id, "", false, 100))
        .unwrap();
    assert!(result.matches.is_empty());
    assert!(result.complete);
}

#[test]
fn search_source_only_streams_across_chunk_boundaries() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("stream.md");
    let text = "abcdHelloWorld-tail\n中文尾巴\n";
    fs::write(&path, text).unwrap();
    assert!(text.len() > 16);

    let config = FilesConfig {
        read_limit_bytes: 16,
        stream_chunk_bytes: 8,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    let opened = service.open_document(&path_str(&path)).unwrap();
    assert!(opened.source_only);

    let result = service
        .search_source(&search_request(&opened.doc_id, "HelloWorld", true, 100))
        .unwrap();
    assert_eq!(
        result.matches.len(),
        1,
        "match spanning a chunk boundary was lost"
    );
    let found = &result.matches[0];
    assert_eq!(found.start_byte, 4);
    assert_eq!(found.end_byte, 14);
    assert_eq!(found.line_number, 1);
    assert!(result.complete);
    assert_eq!(result.scanned_bytes, text.len() as u64);

    // A needle longer than the carry overlap still matches across segments.
    let tail = service
        .search_source(&search_request(&opened.doc_id, "中文尾巴", true, 100))
        .unwrap();
    assert_eq!(tail.matches.len(), 1);
    assert_eq!(tail.matches[0].line_number, 2);

    // An empty query is complete and must not trip the streamed hash check.
    let empty = service
        .search_source(&search_request(&opened.doc_id, "", false, 100))
        .unwrap();
    assert!(empty.matches.is_empty());
    assert!(empty.complete);
}

#[test]
fn search_reports_io_changed_when_the_disk_content_moved_unnoticed() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("large.md");
    let fixed = std::time::SystemTime::UNIX_EPOCH + Duration::from_secs(1_700_000_000);
    let first = "needle one filler\nline two filler\n";
    let second = "needle two filler\nXXXX XXX XXXXXX\n";
    assert_eq!(
        first.len(),
        second.len(),
        "same size keeps the stat check quiet"
    );

    let config = FilesConfig {
        read_limit_bytes: 8,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    write_with_mtime(&path, first, fixed);
    let opened = service.open_document(&path_str(&path)).unwrap();
    assert!(opened.source_only);
    service.get_source_info(&opened.doc_id).unwrap();

    // Same size and same mtime: the cheap stat check passes, but the streamed
    // scan computes a different content hash -> PS_IO_CHANGED (contracts §7).
    write_with_mtime(&path, second, fixed);
    let error = service
        .search_source(&search_request(&opened.doc_id, "needle", true, 100))
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoChanged);
}

fn write_with_mtime(path: &Path, content: &str, modified: std::time::SystemTime) {
    fs::write(path, content).unwrap();
    let file = fs::File::options().write(true).open(path).unwrap();
    file.set_times(fs::FileTimes::new().set_modified(modified))
        .unwrap();
}

#[test]
fn search_source_only_refreshes_to_the_current_disk_version() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("large.md");
    fs::write(&path, "line-0 filler filler\nline-1 filler\n").unwrap();
    let config = FilesConfig {
        read_limit_bytes: 8,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_config(config);
    let opened = service.open_document(&path_str(&path)).unwrap();
    assert!(opened.source_only);

    let replacement = "line-0 filler filler\nline-1 changed needle here\n";
    fs::write(&path, replacement).unwrap();
    let result = service
        .search_source(&search_request(&opened.doc_id, "needle", true, 100))
        .unwrap();
    assert_eq!(result.matches.len(), 1);
    assert!(result.complete);
    assert_eq!(
        result.version.content_hash,
        paperstack_lib::services::files::sha256_hex(replacement.as_bytes())
    );
}

#[test]
fn source_access_never_writes_to_the_source() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("doc.md");
    fs::write(&path, "alpha\nbeta\ngamma\n").unwrap();
    let before = fs::read(&path).unwrap();

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();
    service.get_source_info(&opened.doc_id).unwrap();
    service
        .read_source_window(&window_request(&opened.doc_id, 2, 1))
        .unwrap();
    service
        .search_source(&search_request(&opened.doc_id, "beta", true, 10))
        .unwrap();

    assert_eq!(fs::read(&path).unwrap(), before);
}

#[test]
fn source_access_for_unknown_docs_is_not_found() {
    let mut service = FilesService::new();
    assert_eq!(
        service
            .get_source_info("d-0000000000000000")
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );
}
