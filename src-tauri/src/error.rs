//! Stable error taxonomy `paperstack-ipc-r1` (contracts §5).
//!
//! [`ErrorCode`] is the single table of all 32 stable codes. [`AppError`] is
//! the internal, `thiserror`-based error carrying the code plus optional
//! source range, sanitized details and underlying source; it converts to the
//! wire [`ErrorPayload`] with the i18n `messageKey`.

use std::fmt;
use std::str::FromStr;

use thiserror::Error;

use crate::models::{ErrorCategory, ErrorDetails, ErrorPayload, SourceRange};
use crate::services::diagnostics::sanitize_details;

/// Whether a stable code can carry a `sourceRange` (contracts §5 table).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceRangePolicy {
    /// Column `—`: the code is not about a location inside the document.
    Unused,
    /// Column `可选`: include when a location is known.
    Optional,
    /// Column `有`: a location is expected to be supplied.
    Required,
}

/// The 32 stable error codes of contracts §5.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorCode {
    IoNotFound,
    IoPermission,
    IoReadFailed,
    IoWriteFailed,
    IoChanged,
    IoExportBlocked,
    EncodingUnsupported,
    FormatUnsupported,
    AuthDenied,
    AuthRevoked,
    AuthOutsideRoot,
    RemoteBlocked,
    RemoteProtocol,
    RemoteRedirectBlocked,
    RemoteLimit,
    RemoteFailed,
    ResourceMissing,
    ResourceDecode,
    ResourceUnsupported,
    ParseLocal,
    ParseDoc,
    DbFailure,
    DbMigration,
    StorageUnavailable,
    LimitSize,
    LimitComplexity,
    LimitImage,
    LimitMermaid,
    LimitSearch,
    Internal,
    TaskCancelled,
    WorkerFailed,
}

impl ErrorCode {
    /// All codes in contracts §5 order.
    pub const ALL: [ErrorCode; 32] = [
        ErrorCode::IoNotFound,
        ErrorCode::IoPermission,
        ErrorCode::IoReadFailed,
        ErrorCode::IoWriteFailed,
        ErrorCode::IoChanged,
        ErrorCode::IoExportBlocked,
        ErrorCode::EncodingUnsupported,
        ErrorCode::FormatUnsupported,
        ErrorCode::AuthDenied,
        ErrorCode::AuthRevoked,
        ErrorCode::AuthOutsideRoot,
        ErrorCode::RemoteBlocked,
        ErrorCode::RemoteProtocol,
        ErrorCode::RemoteRedirectBlocked,
        ErrorCode::RemoteLimit,
        ErrorCode::RemoteFailed,
        ErrorCode::ResourceMissing,
        ErrorCode::ResourceDecode,
        ErrorCode::ResourceUnsupported,
        ErrorCode::ParseLocal,
        ErrorCode::ParseDoc,
        ErrorCode::DbFailure,
        ErrorCode::DbMigration,
        ErrorCode::StorageUnavailable,
        ErrorCode::LimitSize,
        ErrorCode::LimitComplexity,
        ErrorCode::LimitImage,
        ErrorCode::LimitMermaid,
        ErrorCode::LimitSearch,
        ErrorCode::Internal,
        ErrorCode::TaskCancelled,
        ErrorCode::WorkerFailed,
    ];

    /// Stable wire code, e.g. `PS_IO_NOT_FOUND`.
    pub const fn as_str(self) -> &'static str {
        match self {
            ErrorCode::IoNotFound => "PS_IO_NOT_FOUND",
            ErrorCode::IoPermission => "PS_IO_PERMISSION",
            ErrorCode::IoReadFailed => "PS_IO_READ_FAILED",
            ErrorCode::IoWriteFailed => "PS_IO_WRITE_FAILED",
            ErrorCode::IoChanged => "PS_IO_CHANGED",
            ErrorCode::IoExportBlocked => "PS_IO_EXPORT_BLOCKED",
            ErrorCode::EncodingUnsupported => "PS_ENC_UNSUPPORTED",
            ErrorCode::FormatUnsupported => "PS_FMT_UNSUPPORTED",
            ErrorCode::AuthDenied => "PS_AUTH_DENIED",
            ErrorCode::AuthRevoked => "PS_AUTH_REVOKED",
            ErrorCode::AuthOutsideRoot => "PS_AUTH_OUTSIDE_ROOT",
            ErrorCode::RemoteBlocked => "PS_REMOTE_BLOCKED",
            ErrorCode::RemoteProtocol => "PS_REMOTE_PROTOCOL",
            ErrorCode::RemoteRedirectBlocked => "PS_REMOTE_REDIRECT_BLOCKED",
            ErrorCode::RemoteLimit => "PS_REMOTE_LIMIT",
            ErrorCode::RemoteFailed => "PS_REMOTE_FAILED",
            ErrorCode::ResourceMissing => "PS_RESOURCE_MISSING",
            ErrorCode::ResourceDecode => "PS_RESOURCE_DECODE",
            ErrorCode::ResourceUnsupported => "PS_RESOURCE_UNSUPPORTED",
            ErrorCode::ParseLocal => "PS_PARSE_LOCAL",
            ErrorCode::ParseDoc => "PS_PARSE_DOC",
            ErrorCode::DbFailure => "PS_DB_FAILURE",
            ErrorCode::DbMigration => "PS_DB_MIGRATION",
            ErrorCode::StorageUnavailable => "PS_STORAGE_UNAVAILABLE",
            ErrorCode::LimitSize => "PS_LIMIT_SIZE",
            ErrorCode::LimitComplexity => "PS_LIMIT_COMPLEXITY",
            ErrorCode::LimitImage => "PS_LIMIT_IMAGE",
            ErrorCode::LimitMermaid => "PS_LIMIT_MERMAID",
            ErrorCode::LimitSearch => "PS_LIMIT_SEARCH",
            ErrorCode::Internal => "PS_INTERNAL",
            ErrorCode::TaskCancelled => "PS_TASK_CANCELLED",
            ErrorCode::WorkerFailed => "PS_WORKER_FAILED",
        }
    }

    /// Error category shown by the UI (contracts §5).
    pub const fn category(self) -> ErrorCategory {
        match self {
            ErrorCode::IoNotFound
            | ErrorCode::IoPermission
            | ErrorCode::IoReadFailed
            | ErrorCode::IoWriteFailed
            | ErrorCode::IoChanged
            | ErrorCode::IoExportBlocked => ErrorCategory::Io,
            ErrorCode::EncodingUnsupported | ErrorCode::FormatUnsupported => {
                ErrorCategory::Encoding
            }
            ErrorCode::AuthDenied | ErrorCode::AuthRevoked | ErrorCode::AuthOutsideRoot => {
                ErrorCategory::Auth
            }
            ErrorCode::RemoteBlocked
            | ErrorCode::RemoteProtocol
            | ErrorCode::RemoteRedirectBlocked
            | ErrorCode::RemoteLimit
            | ErrorCode::RemoteFailed
            | ErrorCode::ResourceMissing
            | ErrorCode::ResourceDecode
            | ErrorCode::ResourceUnsupported => ErrorCategory::Resource,
            ErrorCode::ParseLocal | ErrorCode::ParseDoc => ErrorCategory::Parse,
            ErrorCode::DbFailure | ErrorCode::DbMigration | ErrorCode::StorageUnavailable => {
                ErrorCategory::Storage
            }
            ErrorCode::LimitSize
            | ErrorCode::LimitComplexity
            | ErrorCode::LimitImage
            | ErrorCode::LimitMermaid
            | ErrorCode::LimitSearch => ErrorCategory::Limit,
            ErrorCode::Internal | ErrorCode::TaskCancelled | ErrorCode::WorkerFailed => {
                ErrorCategory::Internal
            }
        }
    }

    /// UI may offer a user-triggered retry action; there is no automatic retry
    /// except for remote images (contracts §5).
    pub const fn retryable(self) -> bool {
        matches!(
            self,
            ErrorCode::IoNotFound
                | ErrorCode::IoPermission
                | ErrorCode::IoReadFailed
                | ErrorCode::IoWriteFailed
                | ErrorCode::IoChanged
                | ErrorCode::RemoteLimit
                | ErrorCode::RemoteFailed
                | ErrorCode::ResourceMissing
                | ErrorCode::ParseDoc
                | ErrorCode::DbFailure
                | ErrorCode::StorageUnavailable
                | ErrorCode::Internal
                | ErrorCode::WorkerFailed
        )
    }

    /// i18n key looked up by the UI for the human message (contracts §5).
    pub const fn message_key(self) -> &'static str {
        match self {
            ErrorCode::IoNotFound => "error.io.notFound",
            ErrorCode::IoPermission => "error.io.permission",
            ErrorCode::IoReadFailed => "error.io.readFailed",
            ErrorCode::IoWriteFailed => "error.io.writeFailed",
            ErrorCode::IoChanged => "error.io.changed",
            ErrorCode::IoExportBlocked => "error.io.exportBlocked",
            ErrorCode::EncodingUnsupported => "error.encoding.unsupported",
            ErrorCode::FormatUnsupported => "error.encoding.formatUnsupported",
            ErrorCode::AuthDenied => "error.auth.denied",
            ErrorCode::AuthRevoked => "error.auth.revoked",
            ErrorCode::AuthOutsideRoot => "error.auth.outsideRoot",
            ErrorCode::RemoteBlocked => "error.resource.remoteBlocked",
            ErrorCode::RemoteProtocol => "error.resource.remoteProtocol",
            ErrorCode::RemoteRedirectBlocked => "error.resource.redirectBlocked",
            ErrorCode::RemoteLimit => "error.resource.remoteLimit",
            ErrorCode::RemoteFailed => "error.resource.remoteFailed",
            ErrorCode::ResourceMissing => "error.resource.missing",
            ErrorCode::ResourceDecode => "error.resource.decode",
            ErrorCode::ResourceUnsupported => "error.resource.unsupported",
            ErrorCode::ParseLocal => "error.parse.local",
            ErrorCode::ParseDoc => "error.parse.document",
            ErrorCode::DbFailure => "error.storage.dbFailure",
            ErrorCode::DbMigration => "error.storage.migration",
            ErrorCode::StorageUnavailable => "error.storage.unavailable",
            ErrorCode::LimitSize => "error.limit.size",
            ErrorCode::LimitComplexity => "error.limit.complexity",
            ErrorCode::LimitImage => "error.limit.image",
            ErrorCode::LimitMermaid => "error.limit.mermaid",
            ErrorCode::LimitSearch => "error.limit.search",
            ErrorCode::Internal => "error.internal.unexpected",
            ErrorCode::TaskCancelled => "error.internal.cancelled",
            ErrorCode::WorkerFailed => "error.internal.worker",
        }
    }

    /// `sourceRange` expectation from the contracts §5 table.
    pub const fn source_range_policy(self) -> SourceRangePolicy {
        match self {
            ErrorCode::ParseLocal | ErrorCode::LimitMermaid => SourceRangePolicy::Required,
            ErrorCode::ResourceMissing
            | ErrorCode::ResourceDecode
            | ErrorCode::ResourceUnsupported
            | ErrorCode::ParseDoc
            | ErrorCode::LimitComplexity
            | ErrorCode::LimitImage => SourceRangePolicy::Optional,
            _ => SourceRangePolicy::Unused,
        }
    }

    /// Short English developer description used in `Display`/logs. Never
    /// user-facing (the UI renders `message_key`).
    pub const fn description(self) -> &'static str {
        match self {
            ErrorCode::IoNotFound => "file or resource not found",
            ErrorCode::IoPermission => "insufficient permission to read",
            ErrorCode::IoReadFailed => "read failed",
            ErrorCode::IoWriteFailed => "write failed",
            ErrorCode::IoChanged => "content changed while reading",
            ErrorCode::IoExportBlocked => "export target is a protected source location",
            ErrorCode::EncodingUnsupported => "unsupported text encoding or binary content",
            ErrorCode::FormatUnsupported => "unsupported document format",
            ErrorCode::AuthDenied => "authorization denied or not confirmed",
            ErrorCode::AuthRevoked => "authorization revoked",
            ErrorCode::AuthOutsideRoot => "target escapes the authorized root",
            ErrorCode::RemoteBlocked => "remote resource not allowed for this session",
            ErrorCode::RemoteProtocol => "protocol not allowed for remote resources",
            ErrorCode::RemoteRedirectBlocked => "redirect target not allowed",
            ErrorCode::RemoteLimit => "remote resource exceeded size or time limits",
            ErrorCode::RemoteFailed => "remote fetch failed",
            ErrorCode::ResourceMissing => "local resource missing",
            ErrorCode::ResourceDecode => "resource could not be decoded",
            ErrorCode::ResourceUnsupported => "unsupported URL or resource type",
            ErrorCode::ParseLocal => "local block parse/render diagnostic",
            ErrorCode::ParseDoc => "document-level parse failure",
            ErrorCode::DbFailure => "database read/write failure",
            ErrorCode::DbMigration => "database migration failure",
            ErrorCode::StorageUnavailable => "storage unavailable, memory fallback",
            ErrorCode::LimitSize => "file exceeds the full-read hard limit",
            ErrorCode::LimitComplexity => "document complexity budget exceeded",
            ErrorCode::LimitImage => "image exceeds size or pixel limits",
            ErrorCode::LimitMermaid => "diagram exceeded node or time limits",
            ErrorCode::LimitSearch => "search budget exceeded, results incomplete",
            ErrorCode::Internal => "unexpected internal error",
            ErrorCode::TaskCancelled => "task cancelled",
            ErrorCode::WorkerFailed => "parse worker unavailable, fallback used",
        }
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for ErrorCode {
    type Err = AppError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        ErrorCode::ALL
            .into_iter()
            .find(|code| code.as_str() == value)
            .ok_or_else(|| {
                AppError::new(ErrorCode::Internal)
                    .with_message(format!("unknown stable error code: {value}"))
            })
    }
}

/// Internal error type: stable code plus optional context. Converts to the
/// wire [`ErrorPayload`]; `Display` includes the stable code so logs remain
/// greppable (contracts §5).
#[derive(Debug, Error)]
#[error("{code}: {message}")]
pub struct AppError {
    code: ErrorCode,
    message: String,
    source_range: Option<SourceRange>,
    details: Option<ErrorDetails>,
    #[source]
    source: Option<Box<dyn std::error::Error + Send + Sync + 'static>>,
}

impl AppError {
    /// Error with the code's default developer description.
    pub fn new(code: ErrorCode) -> Self {
        Self {
            code,
            message: code.description().to_owned(),
            source_range: None,
            details: None,
            source: None,
        }
    }

    /// Overrides the developer message (never user-facing).
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = message.into();
        self
    }

    /// Attaches the underlying cause for diagnostics.
    pub fn with_source(
        mut self,
        source: impl Into<Box<dyn std::error::Error + Send + Sync + 'static>>,
    ) -> Self {
        self.source = Some(source.into());
        self
    }

    /// Attaches a document source range when the code allows one.
    pub fn with_source_range(mut self, source_range: SourceRange) -> Self {
        self.source_range = Some(source_range);
        self
    }

    /// Attaches sanitized, whitelisted details (contracts §3.7).
    pub fn with_details(mut self, details: ErrorDetails) -> Self {
        self.details = Some(details);
        self
    }

    pub fn code(&self) -> ErrorCode {
        self.code
    }

    pub fn category(&self) -> ErrorCategory {
        self.code.category()
    }

    pub fn retryable(&self) -> bool {
        self.code.retryable()
    }

    pub fn message_key(&self) -> &'static str {
        self.code.message_key()
    }

    pub fn source_range(&self) -> Option<SourceRange> {
        self.source_range
    }

    pub fn details(&self) -> Option<&ErrorDetails> {
        self.details.as_ref()
    }

    /// Wire payload with the stable code, category, `messageKey` and
    /// `retryable` flag (contracts §5). This is the single payload exit:
    /// `details` is filtered through the security-model §7 allowlist, so no
    /// caller can smuggle a non-allowlisted key into a payload (A-08).
    pub fn to_payload(&self) -> ErrorPayload {
        ErrorPayload {
            code: self.code.as_str().to_owned(),
            category: self.code.category(),
            message_key: self.code.message_key().to_owned(),
            retryable: self.code.retryable(),
            source_range: self.source_range,
            details: self.details.as_ref().map(sanitize_details),
        }
    }

    /// Maps a read-side `io::Error`: not-found/permission keep their specific
    /// codes, everything else becomes `PS_IO_READ_FAILED`.
    pub fn from_io_read(error: std::io::Error) -> Self {
        let code = match error.kind() {
            std::io::ErrorKind::NotFound => ErrorCode::IoNotFound,
            std::io::ErrorKind::PermissionDenied => ErrorCode::IoPermission,
            _ => ErrorCode::IoReadFailed,
        };
        AppError::new(code).with_source(error)
    }

    /// Maps a write-side `io::Error` to `PS_IO_WRITE_FAILED`.
    pub fn from_io_write(error: std::io::Error) -> Self {
        AppError::new(ErrorCode::IoWriteFailed).with_source(error)
    }

    /// Rebuilds an internal error from a wire payload. Used when a nested
    /// `SaveResult.error` must surface as a command failure: the stable code,
    /// details and source range survive; the developer message carries the
    /// i18n key. Unknown codes fall back to `PS_INTERNAL`.
    pub fn from_payload(payload: &ErrorPayload) -> Self {
        let code = payload
            .code
            .parse::<ErrorCode>()
            .unwrap_or(ErrorCode::Internal);
        let mut error = AppError::new(code).with_message(payload.message_key.clone());
        if let Some(details) = &payload.details {
            error = error.with_details(details.clone());
        }
        if let Some(source_range) = payload.source_range {
            error = error.with_source_range(source_range);
        }
        error
    }
}

impl From<&AppError> for ErrorPayload {
    fn from(error: &AppError) -> Self {
        error.to_payload()
    }
}

impl From<AppError> for ErrorPayload {
    fn from(error: AppError) -> Self {
        error.to_payload()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::DetailValue;
    use std::collections::{BTreeMap, BTreeSet};
    use std::path::Path;

    fn expected_retryable(code: ErrorCode) -> bool {
        !matches!(
            code,
            ErrorCode::IoExportBlocked
                | ErrorCode::EncodingUnsupported
                | ErrorCode::FormatUnsupported
                | ErrorCode::AuthDenied
                | ErrorCode::AuthRevoked
                | ErrorCode::AuthOutsideRoot
                | ErrorCode::RemoteBlocked
                | ErrorCode::RemoteProtocol
                | ErrorCode::RemoteRedirectBlocked
                | ErrorCode::ResourceDecode
                | ErrorCode::ResourceUnsupported
                | ErrorCode::ParseLocal
                | ErrorCode::DbMigration
                | ErrorCode::LimitSize
                | ErrorCode::LimitComplexity
                | ErrorCode::LimitImage
                | ErrorCode::LimitMermaid
                | ErrorCode::LimitSearch
                | ErrorCode::TaskCancelled
        )
    }

    #[test]
    fn all_32_stable_codes_are_listed_exactly_once() {
        assert_eq!(ErrorCode::ALL.len(), 32);
        let codes: BTreeSet<&str> = ErrorCode::ALL.iter().map(|code| code.as_str()).collect();
        assert_eq!(codes.len(), 32);
        for code in ErrorCode::ALL {
            assert_eq!(code.as_str().parse::<ErrorCode>().unwrap(), code);
        }
        assert!("PS_UNKNOWN".parse::<ErrorCode>().is_err());
    }

    #[test]
    fn retryable_flags_match_the_contract_table() {
        for code in ErrorCode::ALL {
            assert_eq!(
                code.retryable(),
                expected_retryable(code),
                "retryable mismatch for {}",
                code.as_str()
            );
        }
    }

    #[test]
    fn source_range_policy_matches_the_contract_table() {
        for code in ErrorCode::ALL {
            let expected = match code {
                ErrorCode::ParseLocal | ErrorCode::LimitMermaid => SourceRangePolicy::Required,
                ErrorCode::ResourceMissing
                | ErrorCode::ResourceDecode
                | ErrorCode::ResourceUnsupported
                | ErrorCode::ParseDoc
                | ErrorCode::LimitComplexity
                | ErrorCode::LimitImage => SourceRangePolicy::Optional,
                _ => SourceRangePolicy::Unused,
            };
            assert_eq!(
                code.source_range_policy(),
                expected,
                "sourceRange policy mismatch for {}",
                code.as_str()
            );
        }
    }

    #[test]
    fn every_message_key_exists_in_the_zh_cn_locale_catalog() {
        let catalog_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../src/locales/zh-CN.json");
        let raw = std::fs::read_to_string(&catalog_path)
            .unwrap_or_else(|error| panic!("cannot read {}: {error}", catalog_path.display()));
        let catalog: serde_json::Value = serde_json::from_str(&raw)
            .unwrap_or_else(|error| panic!("invalid locale JSON: {error}"));
        let entries = catalog
            .as_object()
            .expect("zh-CN.json must be a flat object of keys");
        for code in ErrorCode::ALL {
            assert!(
                entries.contains_key(code.message_key()),
                "missing messageKey {} for {}",
                code.message_key(),
                code.as_str()
            );
        }
        let error_keys: BTreeSet<&str> = entries
            .keys()
            .map(String::as_str)
            .filter(|key| key.starts_with("error."))
            .collect();
        let expected_keys: BTreeSet<&str> = ErrorCode::ALL
            .iter()
            .map(|code| code.message_key())
            .collect();
        assert_eq!(
            error_keys, expected_keys,
            "catalog error keys and codes must match 32/32"
        );
    }

    #[test]
    fn payload_conversion_carries_code_category_key_retryable_and_details() {
        let mut details = BTreeMap::new();
        details.insert(
            "rootCandidate".to_owned(),
            DetailValue::String("/home/user/notes/img".to_owned()),
        );
        let error = AppError::new(ErrorCode::AuthOutsideRoot).with_details(details.clone());
        assert_eq!(error.code(), ErrorCode::AuthOutsideRoot);
        assert_eq!(error.category(), ErrorCategory::Auth);
        assert!(!error.retryable());
        assert_eq!(error.message_key(), "error.auth.outsideRoot");

        let payload = error.to_payload();
        assert_eq!(payload.code, "PS_AUTH_OUTSIDE_ROOT");
        assert_eq!(payload.category, ErrorCategory::Auth);
        assert_eq!(payload.message_key, "error.auth.outsideRoot");
        assert!(!payload.retryable);
        assert_eq!(payload.details, Some(details));
        assert_eq!(payload.source_range, None);

        let value = serde_json::to_value(&payload).unwrap();
        assert_eq!(value["code"], "PS_AUTH_OUTSIDE_ROOT");
        assert!(value.get("sourceRange").is_none());
        let back: ErrorPayload = serde_json::from_value(value).unwrap();
        assert_eq!(back, payload);
        assert_eq!(ErrorPayload::from(&error), payload);
    }

    #[test]
    fn payload_drops_non_allowlisted_details() {
        let mut details = BTreeMap::new();
        details.insert(
            "rootCandidate".to_owned(),
            DetailValue::String("/home/user/notes/img".to_owned()),
        );
        details.insert(
            "operation".to_owned(),
            DetailValue::String("clear".to_owned()),
        );
        details.insert(
            "secretToken".to_owned(),
            DetailValue::String("must-not-leak".to_owned()),
        );
        details.insert("absolutePath".to_owned(), DetailValue::Bool(true));

        let error = AppError::new(ErrorCode::AuthOutsideRoot).with_details(details);
        let payload = error.to_payload();
        let payload_details = payload.details.expect("allowlisted details must survive");
        assert_eq!(
            payload_details.get("rootCandidate"),
            Some(&DetailValue::String("/home/user/notes/img".to_owned()))
        );
        assert!(payload_details.contains_key("operation"));
        assert!(!payload_details.contains_key("secretToken"));
        assert!(!payload_details.contains_key("absolutePath"));
        assert_eq!(payload_details.len(), 2);

        // The source error keeps its details; only the wire exit filters.
        assert_eq!(error.details().map(ErrorDetails::len), Some(4));
    }

    #[test]
    fn io_error_mapping_keeps_specific_kinds() {
        let not_found = AppError::from_io_read(std::io::Error::from(std::io::ErrorKind::NotFound));
        assert_eq!(not_found.code(), ErrorCode::IoNotFound);
        let permission =
            AppError::from_io_read(std::io::Error::from(std::io::ErrorKind::PermissionDenied));
        assert_eq!(permission.code(), ErrorCode::IoPermission);
        let other = AppError::from_io_read(std::io::Error::other("disk"));
        assert_eq!(other.code(), ErrorCode::IoReadFailed);
        assert!(std::error::Error::source(&other).is_some());
        let write = AppError::from_io_write(std::io::Error::other("nope"));
        assert_eq!(write.code(), ErrorCode::IoWriteFailed);
    }

    #[test]
    fn display_contains_the_stable_code() {
        let error = AppError::new(ErrorCode::TaskCancelled);
        assert!(error.to_string().starts_with("PS_TASK_CANCELLED"));
    }
}
