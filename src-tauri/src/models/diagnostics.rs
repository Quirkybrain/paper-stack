//! Contract models for diagnostics, errors and application info
//! (contracts §3.7, §5).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::settings::FrozenLimits;

/// Error category shared by `ErrorPayload` and `DiagnosticIssue`
/// (contracts §5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ErrorCategory {
    Io,
    Encoding,
    Auth,
    Resource,
    Parse,
    Storage,
    Limit,
    Internal,
}

/// A sanitized detail value: string, number or boolean only (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum DetailValue {
    Bool(bool),
    Number(serde_json::Number),
    String(String),
}

/// Whitelisted, already redacted diagnostic details.
pub type ErrorDetails = BTreeMap<String, DetailValue>;

/// Command failure payload; `details` is only for the "technical details"
/// disclosure and must never contain document text or private full paths
/// (contracts §5 rules).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub code: String,
    pub category: ErrorCategory,
    pub message_key: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_range: Option<super::SourceRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<ErrorDetails>,
}

/// Aggregated diagnostic issue (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticIssue {
    pub code: String,
    pub category: ErrorCategory,
    pub message_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_range: Option<super::SourceRange>,
    pub count: u64,
    pub first_seen_at_ms: i64,
}

/// App section of the diagnostics bundle (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsAppInfo {
    pub name: String,
    pub version: String,
    pub ipc_contract: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tauri_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webkit_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os: Option<String>,
}

/// Per-document diagnostics section; identities are shortened/redacted
/// (contracts §3.7; security-model §7).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsDocument {
    pub doc_id_short: String,
    pub display_name_redacted: String,
    pub version_hash: String,
    pub status: String,
    pub issues: Vec<DiagnosticIssue>,
}

/// `DiagnosticsBundle.limits` — the frozen limits plus the diagnostic-only
/// thresholds (`FrozenLimits & { ... }` in contracts §3.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsLimits {
    #[serde(flatten)]
    pub frozen: FrozenLimits,
    pub large_file_bytes: u64,
    pub hard_limit_bytes: u64,
    pub image_bytes: u64,
}

/// Version marker of the redacted diagnostics bundle (contracts §3.7).
pub const DIAGNOSTICS_BUNDLE_VERSION: u8 = 1;

/// Redacted diagnostics bundle; preview bytes are the export bytes
/// (contracts §3.7, §2.1).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsBundle {
    pub bundle_version: u8,
    pub generated_at_ms: i64,
    pub app: DiagnosticsAppInfo,
    pub documents: Vec<DiagnosticsDocument>,
    pub limits: DiagnosticsLimits,
    /// Applied redaction descriptions (R28).
    pub redactions: Vec<String>,
}

/// `preview_diagnostics` request (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsPreviewRequest {
    pub include_source_context: bool,
    pub include_full_paths: bool,
}

/// One preview section size report (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsSection {
    pub name: String,
    pub bytes: u64,
}

/// Generated export preview; `exportId` is a short-lived in-memory handle
/// (contracts §2.1, §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsPreview {
    pub export_id: String,
    pub generated_at_ms: i64,
    pub text: String,
    pub sections: Vec<DiagnosticsSection>,
    pub redaction_count: u64,
    pub expires_at_ms: i64,
}

/// `export_diagnostics` request; must reuse the preview `exportId`
/// (contracts §2.1).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDiagnosticsRequest {
    pub export_id: String,
    pub target_path: String,
    pub overwrite: bool,
}

/// `export_diagnostics` response (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub written_path: String,
    pub bytes: u64,
}

/// Legal/attribution links of the About page (contracts §3.7). `sourceEntryUrl`
/// is explicitly nullable: `null` plus a note means the public source entry is
/// not configured yet (R30; A9).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLegalInfo {
    pub source_entry_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_entry_note: Option<String>,
    pub license_available: bool,
    pub third_party_available: bool,
}

/// `get_app_info` response (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub owner: String,
    pub license: String,
    pub ipc_contract: String,
    pub locale: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tauri_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub webkit_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os: Option<String>,
    pub legal: AppLegalInfo,
}

/// Source of a queued open request (contracts §3.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OpenSource {
    Cli,
    SecondInstance,
}

/// Queued open request from startup arguments or single-instance handover;
/// `cwd` is explicitly nullable (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenRequest {
    pub paths: Vec<String>,
    pub cwd: Option<String>,
    pub source: OpenSource,
}

/// `read_legal_text` request kind (contracts §3.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LegalTextKind {
    License,
    ThirdPartyNotices,
}

/// `read_legal_text` request (contracts §3.7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadLegalTextRequest {
    pub kind: LegalTextKind,
}

/// Bundled legal text (contracts §3.7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegalTextResult {
    pub text: String,
    pub resource_name: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SourceRange;

    #[test]
    fn diagnostics_limits_flatten_into_contract_shape() {
        let limits = DiagnosticsLimits {
            frozen: FrozenLimits::default(),
            large_file_bytes: 10 * 1024 * 1024,
            hard_limit_bytes: 50 * 1024 * 1024,
            image_bytes: 20 * 1024 * 1024,
        };
        let value = serde_json::to_value(limits).unwrap();
        assert_eq!(value["recentLimit"], 100);
        assert_eq!(value["cacheMaxBytes"], 268_435_456u64);
        assert_eq!(value["logMaxBytes"], 10_485_760u64);
        assert_eq!(value["largeFileBytes"], 10_485_760u64);
        assert_eq!(value["hardLimitBytes"], 52_428_800u64);
        assert_eq!(value["imageBytes"], 20_971_520u64);
        assert_eq!(value.as_object().unwrap().len(), 6);
        let back: DiagnosticsLimits = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(serde_json::to_value(back).unwrap(), value);
    }

    #[test]
    fn error_payload_detail_values_are_primitive_only() {
        let payload = ErrorPayload {
            code: "PS_DB_FAILURE".to_owned(),
            category: ErrorCategory::Storage,
            message_key: "error.storage.dbFailure".to_owned(),
            retryable: true,
            source_range: Some(SourceRange {
                start_byte: 4,
                end_byte: 9,
            }),
            details: Some(ErrorDetails::from([
                (
                    "operation".to_owned(),
                    DetailValue::String("clear".to_owned()),
                ),
                ("failures".to_owned(), DetailValue::Number(2u64.into())),
                ("degraded".to_owned(), DetailValue::Bool(true)),
            ])),
        };
        let value = serde_json::to_value(&payload).unwrap();
        assert_eq!(value["code"], "PS_DB_FAILURE");
        assert_eq!(value["category"], "storage");
        assert_eq!(value["messageKey"], "error.storage.dbFailure");
        assert_eq!(value["sourceRange"]["startByte"], 4);
        assert_eq!(value["details"]["failures"], 2);
        assert_eq!(value["details"]["degraded"], true);
        let back: ErrorPayload = serde_json::from_value(value.clone()).unwrap();
        assert_eq!(back, payload);
    }

    #[test]
    fn legal_text_kind_uses_snake_case_third_party_notices() {
        assert_eq!(
            serde_json::to_value(LegalTextKind::ThirdPartyNotices).unwrap(),
            serde_json::json!("third_party_notices")
        );
        assert_eq!(
            serde_json::to_value(LegalTextKind::License).unwrap(),
            serde_json::json!("license")
        );
    }
}
