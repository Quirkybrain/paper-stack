//! Contract models for document watching (contracts §3.3).

use serde::{Deserialize, Serialize};

/// `watch_document` request. `resourcePaths` replaces the whole resource set
/// on every call (contracts §1.7, §3.3).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchRequest {
    pub doc_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_paths: Option<Vec<String>>,
}

/// `WatchChangedPayload.kind` (contracts §3.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WatchKind {
    Modified,
    Removed,
    Appeared,
    Resource,
}

/// `paperstack://watch-changed` payload; never carries content (contracts §4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchChangedPayload {
    pub doc_id: String,
    pub kind: WatchKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_path: Option<String>,
    pub observed_at_ms: i64,
}
