//! Shared contract/semantic vectors, Rust side (T-61; ADR-007; contracts §5;
//! NF11).
//!
//! The JSON files under `tests/contracts/vectors/` are the single source of
//! truth for the front-end and Rust implementations:
//! - `search-parity.json`: literal-search vectors executed here through
//!   `FilesService::search_source` (the same corpus file is scanned by the
//!   front-end suite);
//! - `error-taxonomy.json`: the 32 stable codes of contracts §5 compared field
//!   by field with the compiled `ErrorCode` table;
//! - `utf16-utf8.json`: UTF-16/UTF-8 offset pairs asserted char-boundary exact
//!   with `str::encode_utf16`.
//!
//! Expected values in the vectors come from the contracts/ADR, never from
//! implementation output. `boundaryCases` pins only the accepted ADR-007
//! divergence (length-changing `İ` fold). The former Final_Sigma contract
//! divergence was resolved in wp-32a by aligning the front-end fold to this
//! side's per-code-point fold; its shared expectation is exercised through the
//! normal `cases` mechanism (`greek-final-sigma-per-code-point`, asserted
//! below and by the front-end suite).

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::error::{ErrorCode, SourceRangePolicy};
use paperstack_lib::models::{ErrorCategory, SearchSourceRequest};
use paperstack_lib::services::files::{sha256_hex, FilesService};
use serde_json::Value;
use tempfile::TempDir;

fn repo_path(relative: &str) -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join(relative)
}

fn load_json(relative: &str) -> Value {
    let path = repo_path(relative);
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("invalid JSON in {}: {error}", path.display()))
}

fn path_str(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn search_request(doc_id: &str, query: &str, case_sensitive: bool) -> SearchSourceRequest {
    SearchSourceRequest {
        doc_id: doc_id.to_owned(),
        query: query.to_owned(),
        case_sensitive,
        max_results: 10_000,
    }
}

/// Runs `search_source` on the given corpus bytes and requires a complete scan.
fn scan(corpus: &str, query: &str, case_sensitive: bool) -> Vec<(u64, u64, u64)> {
    let temp = TempDir::new().unwrap();
    let path = temp.path().join("corpus.md");
    fs::write(&path, corpus).unwrap();

    let mut service = FilesService::new();
    let opened = service.open_document(&path_str(&path)).unwrap();
    let result = service
        .search_source(&search_request(&opened.doc_id, query, case_sensitive))
        .unwrap();
    assert!(
        result.complete,
        "corpus must be fully scanned (query={query:?}, scanned={}, total={})",
        result.scanned_bytes, result.total_bytes
    );
    assert_eq!(result.total_bytes, corpus.len() as u64);
    result
        .matches
        .iter()
        .map(|found| (found.start_byte, found.end_byte, found.line_number))
        .collect()
}

fn expected_hits(entry: &Value) -> Vec<(u64, u64, u64)> {
    entry
        .as_array()
        .unwrap()
        .iter()
        .map(|hit| {
            (
                hit["startByte"].as_u64().unwrap(),
                hit["endByte"].as_u64().unwrap(),
                hit["lineNumber"].as_u64().unwrap(),
            )
        })
        .collect()
}

#[test]
fn search_parity_cases_match_the_shared_vectors() {
    let vectors = load_json("../tests/contracts/vectors/search-parity.json");
    let cases = vectors["cases"].as_array().unwrap();
    assert!(cases.len() >= 12, "parity vectors must stay complete");
    let mut query_count = 0usize;
    let mut greek_shared_case_seen = false;
    for case in cases {
        let id = case["id"].as_str().unwrap();
        if id == "greek-final-sigma-per-code-point" {
            // F-32-1 cleanup (wp-32b): the resolved Greek divergence is
            // asserted here as shared parity, not as a boundary divergence.
            greek_shared_case_seen = true;
        }
        let corpus = case["corpus"].as_str().unwrap();
        for query in case["queries"].as_array().unwrap() {
            let needle = query["query"].as_str().unwrap();
            let case_sensitive = query["caseSensitive"].as_bool().unwrap();
            let found = scan(corpus, needle, case_sensitive);
            assert_eq!(
                found,
                expected_hits(&query["expected"]),
                "case {id:?} query {needle:?} caseSensitive={case_sensitive}"
            );
            query_count += 1;
        }
    }
    assert!(
        query_count >= 20,
        "expected the full query matrix, got {query_count}"
    );
    assert!(
        greek_shared_case_seen,
        "the shared Greek final-sigma case must stay exercised through `cases`"
    );
}

#[test]
fn search_parity_fixture_file_matches_the_shared_vectors() {
    let vectors = load_json("../tests/contracts/vectors/search-parity.json");
    let file_cases = vectors["fileCases"].as_array().unwrap();
    assert!(!file_cases.is_empty());
    for case in file_cases {
        let id = case["id"].as_str().unwrap();
        // `corpusFile` is repo-root relative; CARGO_MANIFEST_DIR is src-tauri.
        let corpus_path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join(case["corpusFile"].as_str().unwrap());
        let corpus = fs::read_to_string(&corpus_path).unwrap();
        let mut service = FilesService::new();
        let opened = service.open_document(&path_str(&corpus_path)).unwrap();
        assert_eq!(
            opened.snapshot.as_ref().unwrap().version.content_hash,
            sha256_hex(corpus.as_bytes()),
            "fixture bytes changed; regenerate the vector offsets"
        );
        for query in case["queries"].as_array().unwrap() {
            let needle = query["query"].as_str().unwrap();
            let case_sensitive = query["caseSensitive"].as_bool().unwrap();
            let result = service
                .search_source(&search_request(&opened.doc_id, needle, case_sensitive))
                .unwrap();
            assert!(result.complete, "case {id:?} query {needle:?} not complete");
            let found: Vec<(u64, u64, u64)> = result
                .matches
                .iter()
                .map(|hit| (hit.start_byte, hit.end_byte, hit.line_number))
                .collect();
            assert_eq!(
                found,
                expected_hits(&query["expected"]),
                "case {id:?} query {needle:?} caseSensitive={case_sensitive}"
            );
        }
    }
}

#[test]
fn search_boundary_cases_pin_the_accepted_divergence() {
    let vectors = load_json("../tests/contracts/vectors/search-parity.json");
    let boundary = vectors["boundaryCases"].as_array().unwrap();
    assert!(
        !boundary.is_empty(),
        "the accepted ADR-007 length-changing İ fold must stay pinned"
    );
    let kinds: Vec<&str> = boundary
        .iter()
        .map(|case| case["kind"].as_str().unwrap())
        .collect();
    assert!(
        kinds.contains(&"accepted-length-changing-fold"),
        "the accepted ADR-007 length-changing İ fold must stay pinned"
    );
    for case in boundary {
        let id = case["id"].as_str().unwrap();
        let corpus = case["corpus"].as_str().unwrap();
        for query in case["queries"].as_array().unwrap() {
            let needle = query["query"].as_str().unwrap();
            let case_sensitive = query["caseSensitive"].as_bool().unwrap();
            let rust = scan(corpus, needle, case_sensitive);
            assert_eq!(
                rust,
                expected_hits(&query["rust"]),
                "case {id:?}: Rust behavior changed; revise the vector and the report"
            );
            assert_ne!(
                rust,
                expected_hits(&query["frontend"]),
                "case {id:?}: the accepted divergence closed; revise the vector, the \
                 front-end suite and the report"
            );
        }
    }
}

#[test]
fn error_taxonomy_vector_matches_the_compiled_table_32_of_32() {
    let vectors = load_json("../tests/contracts/vectors/error-taxonomy.json");
    let codes = vectors["codes"].as_array().unwrap();
    assert_eq!(codes.len(), 32, "contracts §5 lists exactly 32 codes");
    assert_eq!(ErrorCode::ALL.len(), 32);

    let category_name = |category: ErrorCategory| -> String {
        serde_json::to_value(category)
            .unwrap()
            .as_str()
            .unwrap()
            .to_owned()
    };
    let policy_name = |code: ErrorCode| -> &'static str {
        match code.source_range_policy() {
            SourceRangePolicy::Unused => "unused",
            SourceRangePolicy::Optional => "optional",
            SourceRangePolicy::Required => "required",
        }
    };

    for (entry, code) in codes.iter().zip(ErrorCode::ALL) {
        assert_eq!(entry["code"].as_str().unwrap(), code.as_str());
        assert_eq!(
            entry["category"].as_str().unwrap(),
            category_name(code.category()),
            "category for {}",
            code.as_str()
        );
        assert_eq!(
            entry["messageKey"].as_str().unwrap(),
            code.message_key(),
            "messageKey for {}",
            code.as_str()
        );
        assert_eq!(
            entry["retryable"].as_bool().unwrap(),
            code.retryable(),
            "retryable for {}",
            code.as_str()
        );
        assert_eq!(
            entry["sourceRange"].as_str().unwrap(),
            policy_name(code),
            "sourceRange policy for {}",
            code.as_str()
        );
    }
}

#[test]
fn utf16_utf8_vectors_are_char_boundary_exact() {
    let vectors = load_json("../tests/contracts/vectors/utf16-utf8.json");
    let texts = vectors["vectors"].as_array().unwrap();
    assert!(texts.len() >= 5);
    for vector in texts {
        let id = vector["id"].as_str().unwrap();
        let text = vector["text"].as_str().unwrap();
        let mut last_byte = 0u64;
        for point in vector["points"].as_array().unwrap() {
            let utf16_index = point["utf16Index"].as_u64().unwrap();
            let byte_offset = point["byteOffset"].as_u64().unwrap() as usize;
            assert!(
                text.is_char_boundary(byte_offset),
                "{id}: byte {byte_offset} is not a char boundary"
            );
            let prefix_utf16 = text[..byte_offset].encode_utf16().count() as u64;
            assert_eq!(
                prefix_utf16, utf16_index,
                "{id}: prefix byte {byte_offset} must hold {utf16_index} UTF-16 units"
            );
            last_byte = last_byte.max(byte_offset as u64);
        }
        assert_eq!(text.len() as u64, last_byte, "{id}: total byte length");
    }
}
