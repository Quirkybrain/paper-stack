//! Shared IPC models mirroring `artifacts/30-architecture/contracts.md`
//! §3.1–§3.7 for contract `paperstack-ipc-r1`.
//!
//! Field names are part of the contract: structs serialize with
//! `rename_all = "camelCase"` and optional (`?`) fields are omitted when
//! `None` (contracts §1.4). Fields typed `T | null` (rather than `T?`)
//! serialize an explicit `null` and therefore do not carry
//! `skip_serializing_if`.

pub mod auth;
pub mod diagnostics;
pub mod directory;
pub mod document;
pub mod settings;
pub mod storage;
pub mod watch;

pub use auth::*;
pub use diagnostics::*;
pub use directory::*;
pub use document::*;
pub use settings::*;
pub use storage::*;
pub use watch::*;

use serde::{Deserialize, Serialize};

/// UTF-8 byte range into the decoded source text, half-open `[start, end)`
/// (contracts §1.2; §3.1 `SourceRange`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceRange {
    pub start_byte: u64,
    pub end_byte: u64,
}

/// Dispatch token for any work crossing an async boundary (contracts §1.6 and
/// the commit rule in §6). `version` is the explicitly nullable target version
/// and therefore serializes `null` rather than being omitted.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskToken {
    pub doc_id: String,
    pub version: Option<String>,
    pub generation: u64,
    pub task_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn task_token_serializes_null_version_and_camel_case() {
        let token = TaskToken {
            doc_id: "d-0123456789abcdef".to_owned(),
            version: None,
            generation: 3,
            task_id: "task-1".to_owned(),
        };
        assert_eq!(
            serde_json::to_value(&token).unwrap(),
            json!({
                "docId": "d-0123456789abcdef",
                "version": null,
                "generation": 3,
                "taskId": "task-1"
            })
        );
    }

    #[test]
    fn source_range_uses_camel_case_byte_offsets() {
        let range = SourceRange {
            start_byte: 12,
            end_byte: 34,
        };
        assert_eq!(
            serde_json::to_value(range).unwrap(),
            json!({ "startByte": 12, "endByte": 34 })
        );
    }
}
