//! Contract models for authorization and resource decisions (contracts
//! §3.6). Per contracts §3.6 there is no separate Rust→TS authorization
//! request payload: `AccessDecision` and `GrantRecord` carry both the request
//! status and the user's decision.

use serde::{Deserialize, Serialize};

use super::diagnostics::ErrorPayload;

/// Grant target family (data-model §3.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GrantKind {
    File,
    Directory,
    Remote,
}

/// Grant lifetime: session grants die with the process, persistent grants are
/// revalidated at startup (data-model §3.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GrantScope {
    Session,
    Persistent,
}

/// `check_resource_access` request; `rawSrc` is the raw document reference and
/// never a permission token (R25).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResourceAccessRequest {
    pub doc_id: String,
    pub raw_src: String,
}

/// `AccessDecision.status` (contracts §3.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AccessDecisionStatus {
    Allowed,
    RemoteBlocked,
    OutsideRoot,
    Missing,
    Unsupported,
    Denied,
}

/// `AccessDecision.kind` (contracts §3.6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccessKind {
    Local,
    Remote,
    Inline,
    Other,
}

/// Status returned by `check_resource_access`; never rejects (contracts
/// §2.1). `assetUrl` is Rust-generated and carries the `?v=` observation key.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessDecision {
    pub status: AccessDecisionStatus,
    pub kind: AccessKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canonical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_candidate: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<ErrorPayload>,
}

/// One authorization record (contracts §3.6; data-model §3.2).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantRecord {
    pub grant_id: String,
    pub kind: GrantKind,
    pub scope: GrantScope,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub canonical_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origins: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub doc_id: Option<String>,
    pub granted_at_ms: i64,
}

/// `grant_local_root` request; `persist` maps to the "remember" checkbox and
/// defaults to false (R25).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantLocalRootRequest {
    pub doc_id: String,
    pub root_path: String,
    pub persist: bool,
}

/// `grant_remote_session` request; origins are `https://host[:port]` (R26).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantRemoteSessionRequest {
    pub doc_id: String,
    pub origins: Vec<String>,
}

/// `fetch_remote_image` request (R26).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchRemoteImageRequest {
    pub doc_id: String,
    pub url: String,
}

/// Successful controlled remote image fetch (contracts §3.6).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteImageResult {
    pub asset_url: String,
    pub mime: String,
    pub size_bytes: u64,
    pub final_url: String,
    pub cache_key: String,
    pub from_cache: bool,
}

/// Effect of a revoke operation (contracts §3.6); cancellation/cache counts
/// are supplied by the resource service once wired (wp-13), the wp-08 registry
/// reports zero for local grants.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeResult {
    pub revoked: bool,
    pub cancelled_requests: u64,
    pub removed_cache_entries: u64,
}
