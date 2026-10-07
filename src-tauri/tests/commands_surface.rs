//! Command-surface and wp-14 service tests (T-18/T-19/T-20).
//!
//! - the maintained `commands::COMMANDS` table matches contracts §2 exactly
//!   (38/38 names, order, module and shapes) and the contract fixtures;
//! - every command's request/response fixture round-trips through its Rust
//!   type (the invoke handler is generated from the same macro list, so the
//!   compile-time registration and this table cannot drift);
//! - diagnostics redaction, log cap, preview/export validation matrix;
//! - `get_app_info` metadata consistency across `Cargo.toml`,
//!   `tauri.conf.json` and `package.json`.

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::commands::COMMANDS;
use paperstack_lib::error::{AppError, ErrorCode};
use paperstack_lib::models::*;
use paperstack_lib::services::auth::AuthRegistry;
use paperstack_lib::services::diagnostics::{
    DiagnosticsService, DocumentDiagnosticsInput, LogCategory, LogEvent, LogField, LogLevel,
    ManualDiagnosticsClock, ProtectedSources, LARGE_FILE_BYTES, LOG_MAX_BYTES, PREVIEW_TTL_MS,
};
use paperstack_lib::services::files::FilesService;
use paperstack_lib::services::info::{
    InfoService, APP_LICENSE, APP_LOCALE, APP_NAME, APP_OWNER, APP_VERSION, IPC_CONTRACT,
    LEGAL_LICENSE_RESOURCE, LEGAL_THIRD_PARTY_RESOURCE, SOURCE_ENTRY_NOTE_KEY,
};
use paperstack_lib::services::paths::SystemPathProbe;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use tempfile::TempDir;

// ---------------------------------------------------------------------------
// Surface table
// ---------------------------------------------------------------------------

/// Independent copy of contracts §2 (row order) used to assert the code table.
const CONTRACT_COMMANDS: [&str; 38] = [
    "pick_files",
    "pick_directory",
    "pick_export_target",
    "open_documents",
    "read_document",
    "relink_document",
    "get_source_info",
    "read_source_window",
    "open_directory",
    "read_directory",
    "watch_document",
    "unwatch_document",
    "list_recents",
    "touch_recent",
    "save_position",
    "load_position",
    "save_session",
    "load_session",
    "get_storage_overview",
    "clear_records",
    "resume_recording",
    "get_settings",
    "update_settings",
    "check_resource_access",
    "grant_local_root",
    "list_grants",
    "revoke_grant",
    "grant_remote_session",
    "revoke_remote_session",
    "fetch_remote_image",
    "open_external_url",
    "reveal_in_folder",
    "get_app_info",
    "read_legal_text",
    "take_pending_open_requests",
    "preview_diagnostics",
    "export_diagnostics",
    "search_source",
];

const CONTRACT_MODULES: [&str; 38] = [
    "files",
    "files",
    "files",
    "files",
    "files",
    "files",
    "files",
    "files",
    "tree",
    "tree",
    "watch",
    "watch",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "storage",
    "auth",
    "auth",
    "auth",
    "auth",
    "resources",
    "resources",
    "resources",
    "app",
    "app",
    "app",
    "app",
    "app",
    "diagnostics",
    "diagnostics",
    "files",
];

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/contracts")
}

fn load_fixture(name: &str) -> Value {
    let path = fixture_dir().join(name);
    let raw = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("cannot read {}: {error}", path.display()));
    serde_json::from_str(&raw)
        .unwrap_or_else(|error| panic!("invalid JSON in {}: {error}", path.display()))
}

fn assert_round_trip<T: Serialize + DeserializeOwned>(raw: &Value, context: &str) {
    let typed: T = serde_json::from_value(raw.clone())
        .unwrap_or_else(|error| panic!("{context}: deserialize failed: {error}\n{raw}"));
    let back = serde_json::to_value(&typed)
        .unwrap_or_else(|error| panic!("{context}: serialize failed: {error}"));
    assert_eq!(&back, raw, "{context}: round-trip mismatch");
}

#[test]
fn command_table_matches_contract_order_names_rows_and_modules() {
    assert_eq!(COMMANDS.len(), 38, "contracts §2 has exactly 38 commands");
    for (index, spec) in COMMANDS.iter().enumerate() {
        assert_eq!(spec.name, CONTRACT_COMMANDS[index], "row {}", index + 1);
        assert_eq!(spec.module, CONTRACT_MODULES[index], "row {}", index + 1);
        assert_eq!(spec.contract_row as usize, index + 1);
        assert!(!spec.request.is_empty());
        assert!(!spec.response.is_empty());
    }
    let unique: std::collections::BTreeSet<&str> = COMMANDS.iter().map(|spec| spec.name).collect();
    assert_eq!(unique.len(), 38);
}

#[test]
fn command_table_is_covered_by_the_contract_fixtures() {
    let fixture = load_fixture("commands.json");
    let entries = fixture["commands"]
        .as_array()
        .expect("commands.json must contain an array");
    let names: Vec<&str> = entries
        .iter()
        .map(|entry| entry["command"].as_str().unwrap())
        .collect();
    let table: Vec<&str> = COMMANDS.iter().map(|spec| spec.name).collect();
    assert_eq!(
        table, names,
        "code surface and contract fixtures must agree"
    );
}

// ---------------------------------------------------------------------------
// Per-command request/response shape round-trips
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocIdEnvelope {
    doc_id: String,
}

#[derive(Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GrantIdEnvelope {
    grant_id: String,
}

#[derive(Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct UrlEnvelope {
    url: String,
}

#[derive(Debug, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct PathEnvelope {
    path: String,
}

#[test]
fn every_command_shape_round_trips_through_its_contract_types() {
    let fixture = load_fixture("commands.json");
    for entry in fixture["commands"].as_array().unwrap() {
        let name = entry["command"].as_str().unwrap();
        let request = &entry["request"];
        let response = &entry["response"];
        match name {
            "pick_files" | "pick_directory" | "pick_export_target" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<PickResult>(response, name);
            }
            "open_documents" => {
                assert_round_trip::<OpenDocumentsRequest>(request, name);
                assert_round_trip::<OpenDocumentsResult>(response, name);
            }
            "read_document" => {
                assert_round_trip::<ReadDocumentRequest>(request, name);
                assert_round_trip::<DocumentSnapshot>(response, name);
            }
            "relink_document" => {
                assert_round_trip::<RelinkRequest>(request, name);
                assert_round_trip::<RelinkResult>(response, name);
            }
            "get_source_info" => {
                assert_round_trip::<DocIdEnvelope>(request, name);
                assert_round_trip::<SourceInfo>(response, name);
            }
            "read_source_window" => {
                assert_round_trip::<ReadSourceWindowRequest>(request, name);
                assert_round_trip::<SourceWindow>(response, name);
            }
            "open_directory" => {
                assert_round_trip::<OpenDirectoryRequest>(request, name);
                assert_round_trip::<DirectoryRoot>(response, name);
            }
            "read_directory" => {
                assert_round_trip::<ReadDirectoryRequest>(request, name);
                assert_round_trip::<DirectoryListing>(response, name);
            }
            "watch_document" => {
                assert_round_trip::<WatchRequest>(request, name);
                assert_empty_response(response, name);
            }
            "unwatch_document" => {
                assert_round_trip::<DocIdEnvelope>(request, name);
                assert_empty_response(response, name);
            }
            "list_recents" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<Vec<RecentEntry>>(response, name);
            }
            "touch_recent" => {
                assert_round_trip::<DocIdEnvelope>(request, name);
                assert_empty_response(response, name);
            }
            "save_position" => {
                assert_round_trip::<SavePositionRequest>(request, name);
                assert_round_trip::<SaveResult>(response, name);
            }
            "load_position" => {
                assert_round_trip::<DocIdEnvelope>(request, name);
                assert_round_trip::<PositionRecord>(response, name);
            }
            "save_session" => {
                assert_round_trip::<SaveSessionRequest>(request, name);
                assert_round_trip::<SaveResult>(response, name);
            }
            "load_session" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<SessionSnapshot>(response, name);
            }
            "get_storage_overview" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<StorageOverview>(response, name);
            }
            "clear_records" => {
                assert_round_trip::<ClearRecordsRequest>(request, name);
                assert_round_trip::<Vec<ClearResult>>(response, name);
            }
            "resume_recording" => {
                assert_round_trip::<ResumeRecordingRequest>(request, name);
                assert_empty_response(response, name);
            }
            "get_settings" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<SettingsBundle>(response, name);
            }
            "update_settings" => {
                assert_round_trip::<UpdateSettingsRequest>(request, name);
                assert_round_trip::<UpdateSettingsResult>(response, name);
            }
            "check_resource_access" => {
                assert_round_trip::<CheckResourceAccessRequest>(request, name);
                assert_round_trip::<AccessDecision>(response, name);
            }
            "grant_local_root" => {
                assert_round_trip::<GrantLocalRootRequest>(request, name);
                assert_round_trip::<GrantRecord>(response, name);
            }
            "list_grants" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<Vec<GrantRecord>>(response, name);
            }
            "revoke_grant" => {
                assert_round_trip::<GrantIdEnvelope>(request, name);
                assert_round_trip::<RevokeResult>(response, name);
            }
            "grant_remote_session" => {
                assert_round_trip::<GrantRemoteSessionRequest>(request, name);
                assert_round_trip::<GrantRecord>(response, name);
            }
            "revoke_remote_session" => {
                assert_round_trip::<DocIdEnvelope>(request, name);
                assert_round_trip::<RevokeResult>(response, name);
            }
            "fetch_remote_image" => {
                assert_round_trip::<FetchRemoteImageRequest>(request, name);
                assert_round_trip::<RemoteImageResult>(response, name);
            }
            "open_external_url" => {
                assert_round_trip::<UrlEnvelope>(request, name);
                assert_empty_response(response, name);
            }
            "reveal_in_folder" => {
                assert_round_trip::<PathEnvelope>(request, name);
                assert_empty_response(response, name);
            }
            "get_app_info" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<AppInfo>(response, name);
            }
            "read_legal_text" => {
                assert_round_trip::<ReadLegalTextRequest>(request, name);
                assert_round_trip::<LegalTextResult>(response, name);
            }
            "take_pending_open_requests" => {
                assert!(request.is_null(), "{name}: no arguments");
                assert_round_trip::<Vec<OpenRequest>>(response, name);
            }
            "preview_diagnostics" => {
                assert_round_trip::<DiagnosticsPreviewRequest>(request, name);
                assert_round_trip::<DiagnosticsPreview>(response, name);
            }
            "export_diagnostics" => {
                assert_round_trip::<ExportDiagnosticsRequest>(request, name);
                assert_round_trip::<ExportResult>(response, name);
            }
            "search_source" => {
                assert_round_trip::<SearchSourceRequest>(request, name);
                assert_round_trip::<SourceSearchResult>(response, name);
            }
            other => panic!("fixture for unknown command: {other}"),
        }
    }
}

fn assert_empty_response(response: &Value, command: &str) {
    assert_eq!(response, &json!({}), "{command}: void response");
}

// ---------------------------------------------------------------------------
// Diagnostics: log cap and redaction
// ---------------------------------------------------------------------------

fn diagnostics_fixture(cap_bytes: u64) -> (TempDir, DiagnosticsService, ManualDiagnosticsClock) {
    let temp = TempDir::new().unwrap();
    let clock = ManualDiagnosticsClock::new(1_770_000_000_000);
    let service = DiagnosticsService::with_config(
        temp.path().join("logs"),
        cap_bytes,
        Box::new(clock.clone()),
    );
    (temp, service, clock)
}

fn log_file_path(temp: &TempDir) -> PathBuf {
    temp.path().join("logs").join("paperstack.log")
}

#[test]
fn rolling_log_cap_keeps_the_newest_lines_within_the_limit() {
    let (temp, service, _clock) = diagnostics_fixture(400);
    for index in 0..30 {
        service.log(&LogEvent {
            level: LogLevel::Info,
            category: LogCategory::Command,
            event: "tick",
            fields: vec![LogField::Number {
                key: "seq",
                value: index,
            }],
        });
    }
    let bytes = fs::metadata(log_file_path(&temp)).unwrap().len();
    assert!(bytes <= 400, "log exceeded the cap: {bytes}");
    assert_eq!(service.log_usage().1, bytes);
    assert_eq!(service.dropped_log_lines(), 0);
    let content = fs::read_to_string(log_file_path(&temp)).unwrap();
    assert!(
        content.contains("seq=29"),
        "the newest line must survive trimming"
    );
    assert!(
        content.contains("truncated"),
        "trimming must be explicit in the file"
    );
}

#[test]
fn log_entries_never_contain_full_paths_or_url_tokens() {
    let (temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    service.log(&LogEvent {
        level: LogLevel::Warn,
        category: LogCategory::Io,
        event: "open_failed",
        fields: vec![
            LogField::Path {
                key: "path",
                value: "/home/someone/private/工作/notes/a.md",
            },
            LogField::Url {
                key: "url",
                value: "https://cdn.example.com/a.png?token=s3cret#frag",
            },
        ],
    });
    let content = fs::read_to_string(log_file_path(&temp)).unwrap();
    assert!(!content.contains("private"), "{content}");
    assert!(!content.contains("token"), "{content}");
    assert!(!content.contains("frag"), "{content}");
    assert!(content.contains("<dir>/notes/a.md"), "{content}");
    assert!(content.contains("https://cdn.example.com"), "{content}");
    assert!(
        content.contains("code") || content.contains("path="),
        "{content}"
    );
}

#[test]
fn command_failures_log_reason_range_and_recovery_and_aggregate_issues() {
    let (temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let error = AppError::new(ErrorCode::IoChanged).with_source_range(SourceRange {
        start_byte: 1,
        end_byte: 2,
    });
    service.record_app_error(Some("d-3f79bb7b435b0532"), &error);
    service.record_app_error(Some("d-3f79bb7b435b0532"), &error);
    service.record_app_error(
        Some("d-3f79bb7b435b0532"),
        &AppError::new(ErrorCode::TaskCancelled),
    );
    let content = fs::read_to_string(log_file_path(&temp)).unwrap();
    assert!(content.contains("code=\"PS_IO_CHANGED\""));
    assert!(content.contains("messageKey=\"error.io.changed\""));
    assert!(content.contains("retryable=true"));
    assert!(content.contains("sourceStartByte=1"));
    assert!(content.contains("sourceEndByte=2"));
    let issues = service.issues_for("d-3f79bb7b435b0532");
    assert_eq!(issues.len(), 1, "task cancellation is not a defect");
    assert_eq!(issues[0].count, 2);
    assert_eq!(issues[0].source_range.unwrap().start_byte, 1);
}

#[test]
fn oversized_single_entries_are_dropped_and_counted() {
    let (temp, service, _clock) = diagnostics_fixture(80);
    service.log(&LogEvent {
        level: LogLevel::Info,
        category: LogCategory::App,
        event: "ok",
        fields: vec![],
    });
    let huge = "x".repeat(200);
    service.log(&LogEvent {
        level: LogLevel::Error,
        category: LogCategory::App,
        event: "huge",
        fields: vec![LogField::Text {
            key: "value",
            value: &huge,
        }],
    });
    assert_eq!(service.dropped_log_lines(), 1);
    assert!(fs::metadata(log_file_path(&temp)).unwrap().len() <= 80);
}

// ---------------------------------------------------------------------------
// Diagnostics: bundle redaction and copy summary
// ---------------------------------------------------------------------------

fn sample_documents() -> Vec<DocumentDiagnosticsInput> {
    vec![DocumentDiagnosticsInput {
        doc_id: "d-3f79bb7b435b0532".to_owned(),
        display_name: "notes/guide.md".to_owned(),
        canonical_path: Some("/home/someone/private/notes/guide.md".to_owned()),
        version_hash: "3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea".to_owned(),
        status: "ok".to_owned(),
    }]
}

fn sample_app() -> DiagnosticsAppInfo {
    DiagnosticsAppInfo {
        name: APP_NAME.to_owned(),
        version: APP_VERSION.to_owned(),
        ipc_contract: IPC_CONTRACT.to_owned(),
        tauri_version: Some(tauri::VERSION.to_owned()),
        webkit_version: None,
        os: Some("linux x86_64".to_owned()),
    }
}

fn sample_limits() -> DiagnosticsLimits {
    DiagnosticsLimits {
        frozen: FrozenLimits::default(),
        large_file_bytes: LARGE_FILE_BYTES,
        hard_limit_bytes: paperstack_lib::services::files::HARD_LIMIT_BYTES,
        image_bytes: paperstack_lib::services::resources::REMOTE_MAX_BYTES,
    }
}

#[test]
fn bundle_default_redaction_drops_source_context_and_counts_it() {
    let (_temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let error = AppError::new(ErrorCode::ParseLocal).with_source_range(SourceRange {
        start_byte: 100,
        end_byte: 120,
    });
    service.record_issue("d-3f79bb7b435b0532", &error);

    let built = service.build_bundle(
        sample_app(),
        &sample_documents(),
        sample_limits(),
        false,
        false,
    );
    let document = &built.bundle.documents[0];
    assert_eq!(document.issues.len(), 1);
    assert!(document.issues[0].source_range.is_none());
    assert_eq!(document.display_name_redacted, "guide.md");
    assert!(built.redaction_count >= 2);
    let rendered = service.render_bundle(&built);
    assert!(rendered.text.contains("source-context"));
    assert!(!rendered.text.contains("sourceRange="));
    assert_eq!(
        rendered
            .sections
            .iter()
            .map(|section| section.name.as_str())
            .collect::<Vec<_>>(),
        ["app", "documents", "limits", "redactions"]
    );
    let rendered_bytes: u64 = rendered.sections.iter().map(|section| section.bytes).sum();
    assert_eq!(rendered_bytes, rendered.text.len() as u64);
}

#[test]
fn bundle_with_explicit_options_keeps_source_context_and_names() {
    let (_temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let error = AppError::new(ErrorCode::ParseLocal).with_source_range(SourceRange {
        start_byte: 100,
        end_byte: 120,
    });
    service.record_issue("d-3f79bb7b435b0532", &error);
    let built = service.build_bundle(
        sample_app(),
        &sample_documents(),
        sample_limits(),
        true,
        true,
    );
    let rendered = service.render_bundle(&built);
    assert!(rendered.text.contains("sourceRange=[100,120)"));
    assert!(rendered.text.contains("notes/guide.md"));
    assert!(!rendered.text.contains("source-context"));
}

#[test]
fn preview_holds_the_exact_export_bytes_and_a_bounded_id() {
    let (_temp, service, clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let preview = service.preview(
        &DiagnosticsPreviewRequest {
            include_source_context: false,
            include_full_paths: false,
        },
        sample_app(),
        &sample_documents(),
        sample_limits(),
    );
    assert!(preview.export_id.starts_with("x-"));
    assert_eq!(
        preview.expires_at_ms,
        preview.generated_at_ms + PREVIEW_TTL_MS
    );
    assert!(preview.text.contains("paperstack-diagnostics"));
    assert!(preview.text.contains("d-3f79bb7b435b0532"));
    assert!(!preview.text.contains("/home/someone/private"));
    clock.advance(PREVIEW_TTL_MS + 1);
    let error = service
        .export(
            &ExportDiagnosticsRequest {
                export_id: preview.export_id.clone(),
                target_path: "/tmp/paperstack-export-test.txt".to_owned(),
                overwrite: true,
            },
            &ProtectedSources::default(),
        )
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoNotFound, "expired exportId");
}

#[test]
fn copy_summary_excludes_paths_and_ranges_unless_explicitly_selected() {
    let (_temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let error = AppError::new(ErrorCode::ResourceMissing).with_source_range(SourceRange {
        start_byte: 5,
        end_byte: 9,
    });
    service.record_issue("d-3f79bb7b435b0532", &error);
    let documents = sample_documents();

    let redacted = service.copy_summary(&sample_app(), &documents, false, false);
    assert!(!redacted.contains("/home/someone/private"));
    assert!(!redacted.contains("sourceRange"));
    assert!(redacted.contains("PS_RESOURCE_MISSING x1"));

    let full = service.copy_summary(&sample_app(), &documents, true, true);
    assert!(full.contains("sourceRange=[5,9)"));
    assert!(full.contains("/home/someone/private/notes/guide.md"));
}

// ---------------------------------------------------------------------------
// Diagnostics: export validation matrix
// ---------------------------------------------------------------------------

fn preview_once(service: &DiagnosticsService) -> DiagnosticsPreview {
    service.preview(
        &DiagnosticsPreviewRequest {
            include_source_context: false,
            include_full_paths: false,
        },
        sample_app(),
        &sample_documents(),
        sample_limits(),
    )
}

fn export_to(
    service: &DiagnosticsService,
    export_id: &str,
    target: &Path,
    overwrite: bool,
    protected: &ProtectedSources,
) -> Result<ExportResult, AppError> {
    service.export(
        &ExportDiagnosticsRequest {
            export_id: export_id.to_owned(),
            target_path: target.to_string_lossy().into_owned(),
            overwrite,
        },
        protected,
    )
}

/// Machine-readable blocked reason carried by `PS_IO_EXPORT_BLOCKED`
/// (D-34b-3/AT28): the UI must never read a protected source target as an
/// overwrite question.
fn export_blocked_reason(error: &AppError) -> &str {
    match error.details().and_then(|details| details.get("reason")) {
        Some(DetailValue::String(value)) => value.as_str(),
        other => panic!("expected string reason detail, got {other:?}"),
    }
}

#[test]
fn export_rejects_open_documents_and_their_parent_directories() {
    let (temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let preview = preview_once(&service);
    let notes = temp.path().join("notes");
    fs::create_dir_all(&notes).unwrap();
    let source = notes.join("guide.md");
    fs::write(&source, "content").unwrap();
    let protected = ProtectedSources::from_paths([fs::canonicalize(&source)
        .unwrap()
        .to_string_lossy()
        .into_owned()]);

    let inside = notes.join("diagnostics.txt");
    let error = export_to(&service, &preview.export_id, &inside, true, &protected).unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoExportBlocked);
    assert_eq!(export_blocked_reason(&error), "protected-source");

    let exact = export_to(&service, &preview.export_id, &source, true, &protected).unwrap_err();
    assert_eq!(exact.code(), ErrorCode::IoExportBlocked);
    assert_eq!(export_blocked_reason(&exact), "protected-source");

    // The failed exports must not consume the preview.
    let outside = temp.path().join("export.txt");
    let result = export_to(&service, &preview.export_id, &outside, false, &protected).unwrap();
    assert_eq!(fs::read_to_string(&outside).unwrap(), preview.text);
    assert_eq!(result.bytes, preview.text.len() as u64);
}

#[test]
fn export_requires_absolute_target_and_overwrite_confirmation() {
    let (temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let preview = preview_once(&service);

    let relative = export_to(
        &service,
        &preview.export_id,
        Path::new("relative/out.txt"),
        true,
        &ProtectedSources::default(),
    )
    .unwrap_err();
    assert_eq!(relative.code(), ErrorCode::IoExportBlocked);
    assert_eq!(export_blocked_reason(&relative), "invalid-target");

    let target = temp.path().join("existing.txt");
    fs::write(&target, "old").unwrap();
    let blocked = export_to(
        &service,
        &preview.export_id,
        &target,
        false,
        &ProtectedSources::default(),
    )
    .unwrap_err();
    assert_eq!(blocked.code(), ErrorCode::IoExportBlocked);
    assert_eq!(export_blocked_reason(&blocked), "target-exists");

    export_to(
        &service,
        &preview.export_id,
        &target,
        true,
        &ProtectedSources::default(),
    )
    .unwrap();
    assert_eq!(fs::read_to_string(&target).unwrap(), preview.text);
}

#[test]
fn export_leaves_no_temp_files_behind() {
    let (temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let preview = preview_once(&service);
    let target = temp.path().join("out.txt");
    export_to(
        &service,
        &preview.export_id,
        &target,
        false,
        &ProtectedSources::default(),
    )
    .unwrap();
    let leftovers: Vec<_> = fs::read_dir(temp.path())
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .contains("paperstack.tmp")
        })
        .collect();
    assert!(leftovers.is_empty(), "atomic write left temp files");
}

#[test]
fn protected_sources_match_component_level() {
    let protected = ProtectedSources::from_paths(["/home/user/notes/guide.md".to_owned()]);
    assert!(protected.blocks(Path::new("/home/user/notes/guide.md")));
    assert!(protected.blocks(Path::new("/home/user/notes/sub/other.txt")));
    assert!(!protected.blocks(Path::new("/home/user/notes-other/other.txt")));
    assert!(!protected.blocks(Path::new("/home/user/elsewhere.txt")));
}

#[test]
fn export_protects_error_state_source_directories_too() {
    // AT28/D-34-7 regression: a document that fails validation (decode error)
    // never registers, but its source directory must still reject diagnostics
    // export targets. This mirrors `collect_protected_sources` (registered
    // documents plus every known source location).
    let (temp, service, _clock) = diagnostics_fixture(LOG_MAX_BYTES);
    let preview = preview_once(&service);

    let registered_dir = temp.path().join("registered");
    fs::create_dir_all(&registered_dir).unwrap();
    let good = registered_dir.join("good.md");
    fs::write(&good, "# ok\n").unwrap();

    let error_dir = temp.path().join("error-state");
    fs::create_dir_all(&error_dir).unwrap();
    let latin1 = error_dir.join("latin1.md");
    fs::write(&latin1, b"\xE9t\xE9 binary-ish\n").unwrap();

    let mut files = FilesService::new();
    files.open_document(&good.to_string_lossy()).unwrap();
    let error = files.open_document(&latin1.to_string_lossy()).unwrap_err();
    assert_eq!(error.code(), ErrorCode::EncodingUnsupported);
    assert_eq!(files.registered_count(), 1);

    let protected = ProtectedSources::from_paths(
        files
            .registered_documents()
            .map(|document| document.canonical_path().to_owned())
            .chain(
                files
                    .known_source_paths()
                    .map(|path| path.to_string_lossy().into_owned()),
            ),
    );

    // Registered document rejection (exact file and inside its directory).
    let registered_exact =
        export_to(&service, &preview.export_id, &good, true, &protected).unwrap_err();
    assert_eq!(registered_exact.code(), ErrorCode::IoExportBlocked);
    let registered_inside = registered_dir.join("probe.txt");
    let error = export_to(
        &service,
        &preview.export_id,
        &registered_inside,
        true,
        &protected,
    )
    .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoExportBlocked);

    // Error-state document rejection: same protection without registration.
    let error_state_inside = error_dir.join("probe-out.txt");
    let error = export_to(
        &service,
        &preview.export_id,
        &error_state_inside,
        true,
        &protected,
    )
    .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoExportBlocked);
    assert_eq!(export_blocked_reason(&error), "protected-source");

    // Non-source target: the export still succeeds with the same preview.
    let outside = temp.path().join("export-ok.txt");
    let result = export_to(&service, &preview.export_id, &outside, false, &protected).unwrap();
    assert_eq!(fs::read_to_string(&outside).unwrap(), preview.text);
    assert_eq!(result.bytes, preview.text.len() as u64);
}

// ---------------------------------------------------------------------------
// Info service: metadata consistency and legal text
// ---------------------------------------------------------------------------

#[test]
fn app_info_matches_crate_package_and_tauri_metadata() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let cargo_toml = fs::read_to_string(manifest_dir.join("Cargo.toml")).unwrap();
    let cargo_version = cargo_toml
        .lines()
        .find_map(|line| line.strip_prefix("version = "))
        .map(|value| value.trim().trim_matches('"').to_owned())
        .expect("Cargo.toml must declare a package version");

    let tauri_conf: Value =
        serde_json::from_str(&fs::read_to_string(manifest_dir.join("tauri.conf.json")).unwrap())
            .unwrap();
    let package: Value =
        serde_json::from_str(&fs::read_to_string(manifest_dir.join("../package.json")).unwrap())
            .unwrap();

    assert_eq!(cargo_version, APP_VERSION);
    assert_eq!(tauri_conf["version"], APP_VERSION);
    assert_eq!(package["version"], APP_VERSION);
    assert!(cargo_toml.contains("authors = [\"Quirkybrain\"]"));
    assert!(cargo_toml.contains("license = \"GPL-3.0-only\""));
    assert_eq!(package["author"], APP_OWNER);
    assert_eq!(package["license"], APP_LICENSE);

    let temp = TempDir::new().unwrap();
    let info = InfoService::new(temp.path()).app_info();
    assert_eq!(info.name, APP_NAME);
    assert_eq!(info.version, APP_VERSION);
    assert_eq!(info.owner, APP_OWNER);
    assert_eq!(info.license, APP_LICENSE);
    assert_eq!(info.ipc_contract, IPC_CONTRACT);
    assert_eq!(info.locale, APP_LOCALE);
    assert_eq!(
        info.legal.source_entry_note.as_deref(),
        Some(SOURCE_ENTRY_NOTE_KEY)
    );
    assert!(info.legal.source_entry_url.is_none());
    assert!(info.tauri_version.is_some());
}

#[test]
fn legal_texts_read_bundled_resources_and_report_missing_ones() {
    let temp = TempDir::new().unwrap();
    let service = InfoService::new(temp.path());
    assert_eq!(service.legal_availability(), (false, false));
    assert_eq!(
        service
            .read_legal_text(LegalTextKind::License)
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );

    fs::write(temp.path().join(LEGAL_LICENSE_RESOURCE), "GPL-3.0 text").unwrap();
    fs::write(
        temp.path().join(LEGAL_THIRD_PARTY_RESOURCE),
        "third party notices",
    )
    .unwrap();
    assert_eq!(service.legal_availability(), (true, true));
    let license = service.read_legal_text(LegalTextKind::License).unwrap();
    assert_eq!(license.resource_name, LEGAL_LICENSE_RESOURCE);
    assert_eq!(license.text, "GPL-3.0 text");
    let notices = service
        .read_legal_text(LegalTextKind::ThirdPartyNotices)
        .unwrap();
    assert_eq!(notices.resource_name, LEGAL_THIRD_PARTY_RESOURCE);
}

#[test]
fn reveal_target_requires_registration_and_authorization() {
    let temp = TempDir::new().unwrap();
    let notes = temp.path().join("notes");
    fs::create_dir_all(&notes).unwrap();
    let guide = notes.join("guide.md");
    fs::write(&guide, "content").unwrap();
    let secret = temp.path().join("secret");
    fs::create_dir_all(&secret).unwrap();
    let hidden = secret.join("hidden.md");
    fs::write(&hidden, "content").unwrap();

    let mut auth = AuthRegistry::new();
    auth.grant_file(&fs::canonicalize(&guide).unwrap(), 0)
        .unwrap();
    let resolved = paperstack_lib::services::info::resolve_reveal_target(
        &SystemPathProbe,
        &auth,
        guide.to_string_lossy().as_ref(),
    )
    .unwrap();
    assert_eq!(resolved, fs::canonicalize(&guide).unwrap());

    let error = paperstack_lib::services::info::resolve_reveal_target(
        &SystemPathProbe,
        &auth,
        hidden.to_string_lossy().as_ref(),
    )
    .unwrap_err();
    assert_eq!(error.code(), ErrorCode::AuthOutsideRoot);

    let missing = paperstack_lib::services::info::resolve_reveal_target(
        &SystemPathProbe,
        &auth,
        temp.path().join("nope.md").to_string_lossy().as_ref(),
    )
    .unwrap_err();
    assert_eq!(missing.code(), ErrorCode::IoNotFound);

    // A directory grant also authorizes revealing its children.
    auth.grant_directory(&fs::canonicalize(&secret).unwrap(), false, 1)
        .unwrap();
    assert!(paperstack_lib::services::info::resolve_reveal_target(
        &SystemPathProbe,
        &auth,
        hidden.to_string_lossy().as_ref(),
    )
    .is_ok());
}

#[test]
fn diagnostic_issue_serialization_matches_the_contract_shape() {
    let issue = DiagnosticIssue {
        code: "PS_RESOURCE_MISSING".to_owned(),
        category: ErrorCategory::Resource,
        message_key: "error.resource.missing".to_owned(),
        source_range: Some(SourceRange {
            start_byte: 300,
            end_byte: 320,
        }),
        count: 2,
        first_seen_at_ms: 1_770_000_000_000,
    };
    let value = serde_json::to_value(&issue).unwrap();
    assert_eq!(value["category"], "resource");
    assert_eq!(value["messageKey"], "error.resource.missing");
    assert_eq!(value["sourceRange"]["startByte"], 300);
    assert_eq!(value["count"], 2);
}
