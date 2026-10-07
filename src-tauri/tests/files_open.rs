//! Open-validation and decoding matrix (contracts §2.1 command 4; T-08):
//! extension, existence, readability, regular-file kind, BOM stripping,
//! binary/non-UTF-8 rejection, empty/CRLF success and the no-write guarantee.

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::{ReadPurpose, TextEncoding};
use paperstack_lib::services::files::{self, FilesService};
use tempfile::TempDir;

fn encoding_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/encoding")
}

fn fixture(name: &str) -> PathBuf {
    encoding_dir().join(name)
}

fn path_str(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn fixture_code(name: &str) -> ErrorCode {
    let mut service = FilesService::new();
    service
        .open_document(&path_str(&fixture(name)))
        .unwrap_err()
        .code()
}

#[test]
fn open_accepts_utf8_cjk_emoji_and_records_version_identity() {
    let mut service = FilesService::new();
    let path = fixture("utf8-cn-emoji.md");
    let raw = fs::read(&path).unwrap();
    let expected_text = String::from_utf8(raw.clone()).unwrap();

    let opened = service.open_document(&path_str(&path)).unwrap();
    assert!(!opened.duplicate);
    assert!(!opened.source_only);
    assert_eq!(opened.doc_id, opened.identity.doc_id);
    assert!(opened.doc_id.starts_with("d-"));
    assert_eq!(opened.doc_id.len(), 18);
    assert_eq!(
        opened.identity.doc_id,
        files::doc_id_for(&opened.identity.canonical_path)
    );

    let snapshot = opened.snapshot.expect("full-read snapshot");
    assert_eq!(snapshot.text, expected_text);
    assert_eq!(snapshot.identity.encoding, TextEncoding::Utf8);
    assert_eq!(snapshot.identity.display_name, "utf8-cn-emoji.md");
    assert_eq!(snapshot.identity.size_bytes, raw.len() as u64);
    assert_eq!(snapshot.version.size_bytes, raw.len() as u64);
    assert_eq!(snapshot.version.content_hash, files::sha256_hex(&raw));
    assert_eq!(
        snapshot.line_count,
        expected_text.split('\n').count() as u64
    );
    assert_eq!(snapshot.line_count, files::line_count(&expected_text));
    assert!(snapshot.version.modified_at_ms > 0);
    assert!(snapshot.version.observed_at_ms >= snapshot.version.modified_at_ms);
}

#[test]
fn open_rejects_non_markdown_extensions_case_insensitively() {
    let temp = TempDir::new().unwrap();
    let text = temp.path().join("note.txt");
    fs::write(&text, "# nope\n").unwrap();
    let plain = temp.path().join("no-extension");
    fs::write(&plain, "# nope\n").unwrap();

    let mut service = FilesService::new();
    assert_eq!(
        service.open_document(&path_str(&text)).unwrap_err().code(),
        ErrorCode::FormatUnsupported
    );
    assert_eq!(
        service.open_document(&path_str(&plain)).unwrap_err().code(),
        ErrorCode::FormatUnsupported
    );

    let upper = temp.path().join("NOTES.MD");
    fs::write(&upper, "# ok\n").unwrap();
    let opened = service.open_document(&path_str(&upper)).unwrap();
    assert_eq!(opened.identity.display_name, "NOTES.MD");
}

#[test]
fn open_missing_target_is_not_found() {
    let temp = TempDir::new().unwrap();
    let missing = temp.path().join("missing.md");
    let mut service = FilesService::new();
    assert_eq!(
        service
            .open_document(&path_str(&missing))
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );
}

#[test]
fn open_directory_with_markdown_name_is_format_unsupported() {
    let temp = TempDir::new().unwrap();
    let directory = temp.path().join("folder.md");
    fs::create_dir(&directory).unwrap();
    let mut service = FilesService::new();
    assert_eq!(
        service
            .open_document(&path_str(&directory))
            .unwrap_err()
            .code(),
        ErrorCode::FormatUnsupported
    );
}

#[test]
fn open_binary_and_latin1_are_encoding_unsupported() {
    assert_eq!(fixture_code("binary.md"), ErrorCode::EncodingUnsupported);
    assert_eq!(fixture_code("latin1.md"), ErrorCode::EncodingUnsupported);
}

#[test]
fn rejected_encoding_source_is_remembered_as_a_known_source() {
    // AT28/D-34-7: a readable markdown target that fails decoding never
    // registers, but its canonical location must remain known so diagnostics
    // export can protect its source directory.
    let mut service = FilesService::new();
    let latin1 = fixture("latin1.md");
    let error = service.open_document(&path_str(&latin1)).unwrap_err();
    assert_eq!(error.code(), ErrorCode::EncodingUnsupported);
    assert_eq!(service.registered_count(), 0);

    let canonical = fs::canonicalize(&latin1).unwrap();
    let known: Vec<PathBuf> = service.known_source_paths().cloned().collect();
    assert_eq!(known, vec![canonical]);
}

#[test]
fn open_bom_is_detected_and_stripped_from_text_only() {
    let mut service = FilesService::new();
    let path = fixture("bom.md");
    let raw = fs::read(&path).unwrap();
    assert!(raw.starts_with(&[0xEF, 0xBB, 0xBF]));

    let opened = service.open_document(&path_str(&path)).unwrap();
    let snapshot = opened.snapshot.unwrap();
    assert_eq!(snapshot.identity.encoding, TextEncoding::Utf8Bom);
    assert!(!snapshot.text.starts_with('\u{feff}'));
    assert_eq!(snapshot.text, "# BOM 文档\n正文一\n正文二\n");
    // Version hash covers the raw bytes *including* the BOM.
    assert_eq!(snapshot.version.content_hash, files::sha256_hex(&raw));
    assert_eq!(
        fs::read(&path).unwrap(),
        raw,
        "open must never rewrite the source"
    );
}

#[test]
fn open_empty_file_is_a_successful_empty_document() {
    let mut service = FilesService::new();
    let opened = service
        .open_document(&path_str(&fixture("empty.md")))
        .unwrap();
    let snapshot = opened.snapshot.unwrap();
    assert_eq!(snapshot.text, "");
    assert_eq!(snapshot.line_count, 1);
    assert_eq!(snapshot.identity.encoding, TextEncoding::Utf8);
    assert_eq!(snapshot.version.content_hash, files::sha256_hex(&[]));
    assert_eq!(snapshot.version.size_bytes, 0);
}

#[test]
fn open_preserves_crlf_exactly() {
    let mut service = FilesService::new();
    let path = fixture("crlf.md");
    let raw = fs::read(&path).unwrap();
    let opened = service.open_document(&path_str(&path)).unwrap();
    let snapshot = opened.snapshot.unwrap();
    assert_eq!(snapshot.text.as_bytes(), raw.as_slice());
    assert!(snapshot.text.contains("\r\n"));
    assert_eq!(snapshot.line_count, 3);
}

#[test]
fn open_and_read_never_write_to_the_source() {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("stable.md");
    fs::write(&path, "# 原样\r\n第二行\n").unwrap();
    let before = fs::read(&path).unwrap();
    let before_entries: Vec<String> = directory_names(temp.path());

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();
    let doc_id = opened.doc_id.clone();
    service
        .read_document(&doc_id, ReadPurpose::Initial)
        .unwrap();
    service
        .read_document(&doc_id, ReadPurpose::Refresh)
        .unwrap();
    service.get_source_info(&doc_id).unwrap();

    assert_eq!(fs::read(&path).unwrap(), before, "source bytes changed");
    assert_eq!(directory_names(temp.path()), before_entries);
}

fn directory_names(path: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(path)
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    names
}

#[test]
fn open_same_canonical_path_is_a_duplicate_with_stable_doc_id() {
    let mut service = FilesService::new();
    let path = fixture("utf8-cn-emoji.md");
    let first = service.open_document(&path_str(&path)).unwrap();
    let second = service.open_document(&path_str(&path)).unwrap();
    assert!(!first.duplicate);
    assert!(second.duplicate);
    assert_eq!(first.doc_id, second.doc_id);
    assert_eq!(service.registered_count(), 1);
}

#[test]
fn open_distinguishes_case_sensitive_paths() {
    let temp = TempDir::new().unwrap();
    let upper = temp.path().join("Notes.MD");
    let lower = temp.path().join("notes.md");
    fs::write(&upper, "# upper\n").unwrap();
    fs::write(&lower, "# lower\n").unwrap();

    let mut service = FilesService::new();
    let upper_doc = service.open_document(&path_str(&upper)).unwrap();
    let lower_doc = service.open_document(&path_str(&lower)).unwrap();
    assert_ne!(upper_doc.doc_id, lower_doc.doc_id);
    assert_eq!(service.registered_count(), 2);
}

#[test]
fn open_unreadable_file_is_permission_denied_when_not_root() {
    use std::os::unix::fs::PermissionsExt;
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("secret.md");
    fs::write(&path, "# secret\n").unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();

    let mut service = FilesService::new();
    let result = service.open_document(&path_str(&path));
    // `chmod 000` does not restrict root; treat that as an environment skip.
    if let Err(error) = result {
        assert_eq!(error.code(), ErrorCode::IoPermission);
    }
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
}
