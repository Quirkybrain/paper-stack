//! Contract models for the directory tree (contracts §3.2).

use serde::{Deserialize, Serialize};

use super::auth::GrantScope;

/// `open_directory` request; `persist` defaults to false (R25).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenDirectoryRequest {
    pub path: String,
    pub persist: bool,
}

/// Registered directory root (contracts §3.2).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryRoot {
    pub root_id: String,
    pub canonical_path: String,
    pub display_name: String,
    pub scope: GrantScope,
}

/// `read_directory` request; `dirPath` must live inside the registered root.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDirectoryRequest {
    pub root_id: String,
    pub dir_path: String,
}

/// One directory listing entry (contracts §3.2). For symlinks `path` is the
/// link's own path and `symlinkTarget` carries the resolved target when it can
/// be read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryNode {
    pub name: String,
    pub path: String,
    pub kind: DirectoryNodeKind,
    pub status: DirectoryNodeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_children: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_markdown: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub symlink_target: Option<String>,
}

/// `DirectoryNode.kind` (contracts §3.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DirectoryNodeKind {
    File,
    Directory,
    Symlink,
    Other,
}

/// `DirectoryNode.status` (contracts §3.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DirectoryNodeStatus {
    Ok,
    Missing,
    NoPermission,
    OutOfRoot,
    SymlinkInside,
    SymlinkOutside,
}

/// One directory listing; a single directory is truncated at 2000 entries.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListing {
    pub dir_path: String,
    pub entries: Vec<DirectoryNode>,
    pub truncated: bool,
}
