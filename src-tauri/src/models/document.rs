//! Contract models for documents, versions, source windows and search
//! (contracts §3.1).

use serde::{Deserialize, Serialize};

use super::diagnostics::ErrorPayload;

/// `DocIdentity.format` — v0.1.0 supports Markdown only (plan §3.5 adapter
/// boundary).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentFormat {
    Markdown,
}

/// `DocIdentity.encoding` (contracts §3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TextEncoding {
    #[serde(rename = "utf-8")]
    Utf8,
    #[serde(rename = "utf-8-bom")]
    Utf8Bom,
}

/// Stable, opaque document identity (data-model §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocIdentity {
    pub doc_id: String,
    pub canonical_path: String,
    pub display_name: String,
    pub format: DocumentFormat,
    pub encoding: TextEncoding,
    pub content_hash: String,
    pub size_bytes: u64,
    pub last_seen_at_ms: i64,
}

/// Content version observed by Rust (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub content_hash: String,
    pub size_bytes: u64,
    pub modified_at_ms: i64,
    pub observed_at_ms: i64,
}

/// Decoded document snapshot; the version is the content hash (contracts
/// §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSnapshot {
    pub doc_id: String,
    pub identity: DocIdentity,
    pub version: VersionInfo,
    pub text: String,
    pub line_count: u64,
}

/// Per-path outcome of `open_documents` (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenOutcome {
    pub path: String,
    pub status: OpenStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity: Option<DocIdentity>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duplicate_of_doc_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ErrorPayload>,
}

/// `OpenOutcome.status` (contracts §3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OpenStatus {
    Opened,
    Duplicate,
    Rejected,
}

/// Entry point that produced an open request (contracts §3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OpenEntry {
    Dialog,
    Drop,
    Cli,
    System,
    Tree,
    Recent,
    Restore,
}

/// `open_documents` request (contracts §3.1); items are validated
/// independently and results keep input order.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDocumentsRequest {
    pub paths: Vec<String>,
    pub entry: OpenEntry,
}

/// `open_documents` response (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDocumentsResult {
    pub items: Vec<OpenOutcome>,
}

/// Result of a native picker command (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PickResult {
    pub cancelled: bool,
    pub paths: Vec<String>,
}

/// Purpose of a `read_document` call (contracts §3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReadPurpose {
    Initial,
    Refresh,
    Restore,
    Relink,
}

/// `read_document` request (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDocumentRequest {
    pub doc_id: String,
    pub purpose: ReadPurpose,
}

/// `relink_document` request (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelinkRequest {
    pub doc_id: String,
    pub new_path: String,
}

/// `relink_document` outcome: same bytes reassociate, different bytes become a
/// new version of the same document (R07).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelinkResult {
    pub status: RelinkStatus,
    pub snapshot: DocumentSnapshot,
}

/// `RelinkResult.status` (contracts §3.1).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RelinkStatus {
    Reassociated,
    NewVersion,
}

/// Source view info for an already-registered document (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceInfo {
    pub doc_id: String,
    pub version: VersionInfo,
    pub encoding: TextEncoding,
    pub total_lines: u64,
}

/// `read_source_window` request; `startLine >= 1`, `maxLines` in 1..=2000
/// (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadSourceWindowRequest {
    pub doc_id: String,
    pub start_line: u64,
    pub max_lines: u64,
}

/// Line-bounded source window for the same displayed version (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceWindow {
    pub doc_id: String,
    pub version: VersionInfo,
    pub start_line: u64,
    pub end_line: u64,
    pub text: String,
    pub eof: bool,
}

/// `search_source` request; only used in >50MiB source-window mode and `query`
/// is a literal string (contracts §2.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSourceRequest {
    pub doc_id: String,
    pub query: String,
    pub case_sensitive: bool,
    pub max_results: u64,
}

/// One literal match inside the decoded source text (contracts §3.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSearchMatch {
    pub start_byte: u64,
    pub end_byte: u64,
    pub line_number: u64,
}

/// `search_source` response; `complete=false` must never be reported as a
/// complete scan (contracts §2.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSearchResult {
    pub doc_id: String,
    pub version: VersionInfo,
    pub matches: Vec<SourceSearchMatch>,
    pub scanned_bytes: u64,
    pub total_bytes: u64,
    pub complete: bool,
}
