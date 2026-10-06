//! Contract shape tests against `fixtures/contracts/**` (paperstack-ipc-r1).
//!
//! Every command in contracts §2 has one valid request+response sample. The
//! test deserializes each sample into the Rust contract type, serializes it
//! back and requires the normalized JSON to be byte-identical to the fixture,
//! which pins field names (`camelCase`), enum spellings and the
//! `Option`/omit rules (contracts §1.4).

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use paperstack_lib::models::*;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};

/// All 38 commands of contracts §2 in index order.
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

/// Inline request envelopes from contracts §2 that have no named §3 model.
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

fn fixture_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/contracts")
}

fn load_fixture(name: &str) -> Value {
    let path = fixture_dir().join(name);
    let raw = std::fs::read_to_string(&path)
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

fn expect_no_request(request: &Value, command: &str) {
    assert!(
        request.is_null(),
        "{command}: no-argument command must have a null request"
    );
}

fn expect_empty_response(response: &Value, command: &str) {
    assert_eq!(
        response,
        &json!({}),
        "{command}: response must be the empty object"
    );
}

fn check_command(command: &str, request: &Value, response: &Value) {
    match command {
        "pick_files" | "pick_directory" | "pick_export_target" => {
            expect_no_request(request, command);
            assert_round_trip::<PickResult>(response, command);
        }
        "open_documents" => {
            assert_round_trip::<OpenDocumentsRequest>(request, command);
            assert_round_trip::<OpenDocumentsResult>(response, command);
        }
        "read_document" => {
            assert_round_trip::<ReadDocumentRequest>(request, command);
            assert_round_trip::<DocumentSnapshot>(response, command);
        }
        "relink_document" => {
            assert_round_trip::<RelinkRequest>(request, command);
            assert_round_trip::<RelinkResult>(response, command);
        }
        "get_source_info" => {
            assert_round_trip::<DocIdEnvelope>(request, command);
            assert_round_trip::<SourceInfo>(response, command);
        }
        "read_source_window" => {
            assert_round_trip::<ReadSourceWindowRequest>(request, command);
            assert_round_trip::<SourceWindow>(response, command);
        }
        "open_directory" => {
            assert_round_trip::<OpenDirectoryRequest>(request, command);
            assert_round_trip::<DirectoryRoot>(response, command);
        }
        "read_directory" => {
            assert_round_trip::<ReadDirectoryRequest>(request, command);
            assert_round_trip::<DirectoryListing>(response, command);
        }
        "watch_document" => {
            assert_round_trip::<WatchRequest>(request, command);
            expect_empty_response(response, command);
        }
        "unwatch_document" => {
            assert_round_trip::<DocIdEnvelope>(request, command);
            expect_empty_response(response, command);
        }
        "list_recents" => {
            expect_no_request(request, command);
            assert_round_trip::<Vec<RecentEntry>>(response, command);
        }
        "touch_recent" => {
            assert_round_trip::<DocIdEnvelope>(request, command);
            expect_empty_response(response, command);
        }
        "save_position" => {
            assert_round_trip::<SavePositionRequest>(request, command);
            assert_round_trip::<SaveResult>(response, command);
        }
        "load_position" => {
            assert_round_trip::<DocIdEnvelope>(request, command);
            assert_round_trip::<PositionRecord>(response, command);
        }
        "save_session" => {
            assert_round_trip::<SaveSessionRequest>(request, command);
            assert_round_trip::<SaveResult>(response, command);
        }
        "load_session" => {
            expect_no_request(request, command);
            assert_round_trip::<SessionSnapshot>(response, command);
        }
        "get_storage_overview" => {
            expect_no_request(request, command);
            assert_round_trip::<StorageOverview>(response, command);
        }
        "clear_records" => {
            assert_round_trip::<ClearRecordsRequest>(request, command);
            assert_round_trip::<Vec<ClearResult>>(response, command);
        }
        "resume_recording" => {
            assert_round_trip::<ResumeRecordingRequest>(request, command);
            expect_empty_response(response, command);
        }
        "get_settings" => {
            expect_no_request(request, command);
            assert_round_trip::<SettingsBundle>(response, command);
        }
        "update_settings" => {
            assert_round_trip::<UpdateSettingsRequest>(request, command);
            assert_round_trip::<UpdateSettingsResult>(response, command);
        }
        "check_resource_access" => {
            assert_round_trip::<CheckResourceAccessRequest>(request, command);
            assert_round_trip::<AccessDecision>(response, command);
        }
        "grant_local_root" => {
            assert_round_trip::<GrantLocalRootRequest>(request, command);
            assert_round_trip::<GrantRecord>(response, command);
        }
        "list_grants" => {
            expect_no_request(request, command);
            assert_round_trip::<Vec<GrantRecord>>(response, command);
        }
        "revoke_grant" => {
            assert_round_trip::<GrantIdEnvelope>(request, command);
            assert_round_trip::<RevokeResult>(response, command);
        }
        "grant_remote_session" => {
            assert_round_trip::<GrantRemoteSessionRequest>(request, command);
            assert_round_trip::<GrantRecord>(response, command);
        }
        "revoke_remote_session" => {
            assert_round_trip::<DocIdEnvelope>(request, command);
            assert_round_trip::<RevokeResult>(response, command);
        }
        "fetch_remote_image" => {
            assert_round_trip::<FetchRemoteImageRequest>(request, command);
            assert_round_trip::<RemoteImageResult>(response, command);
        }
        "open_external_url" => {
            assert_round_trip::<UrlEnvelope>(request, command);
            expect_empty_response(response, command);
        }
        "reveal_in_folder" => {
            assert_round_trip::<PathEnvelope>(request, command);
            expect_empty_response(response, command);
        }
        "get_app_info" => {
            expect_no_request(request, command);
            assert_round_trip::<AppInfo>(response, command);
        }
        "read_legal_text" => {
            assert_round_trip::<ReadLegalTextRequest>(request, command);
            assert_round_trip::<LegalTextResult>(response, command);
        }
        "take_pending_open_requests" => {
            expect_no_request(request, command);
            assert_round_trip::<Vec<OpenRequest>>(response, command);
        }
        "preview_diagnostics" => {
            assert_round_trip::<DiagnosticsPreviewRequest>(request, command);
            assert_round_trip::<DiagnosticsPreview>(response, command);
        }
        "export_diagnostics" => {
            assert_round_trip::<ExportDiagnosticsRequest>(request, command);
            assert_round_trip::<ExportResult>(response, command);
        }
        "search_source" => {
            assert_round_trip::<SearchSourceRequest>(request, command);
            assert_round_trip::<SourceSearchResult>(response, command);
        }
        other => panic!("fixture for unknown command: {other}"),
    }
}

#[test]
fn command_fixtures_cover_all_38_commands_in_contract_order() {
    let fixture = load_fixture("commands.json");
    assert_eq!(fixture["contract"], "paperstack-ipc-r1");
    let commands = fixture["commands"]
        .as_array()
        .expect("commands.json must contain an array");
    assert_eq!(commands.len(), 38, "one sample per contract command");

    let names: Vec<&str> = commands
        .iter()
        .map(|entry| {
            entry["command"]
                .as_str()
                .expect("every fixture entry needs a command name")
        })
        .collect();
    assert_eq!(names, CONTRACT_COMMANDS, "command order and coverage");

    let unique: BTreeSet<&str> = names.iter().copied().collect();
    assert_eq!(unique.len(), 38, "command names must be unique");

    for entry in commands {
        let command = entry["command"].as_str().unwrap();
        assert!(
            !entry["response"].is_null(),
            "{command}: response sample is required"
        );
        check_command(command, &entry["request"], &entry["response"]);
    }
}

#[test]
fn model_fixtures_round_trip_events_tokens_and_diagnostics() {
    let fixture = load_fixture("models.json");
    assert_eq!(fixture["contract"], "paperstack-ipc-r1");
    let models = fixture["models"]
        .as_object()
        .expect("models.json must contain an object");
    let names: BTreeSet<&str> = models.keys().map(String::as_str).collect();
    let expected: BTreeSet<&str> = ["diagnostics_bundle", "task_token", "watch_changed"]
        .into_iter()
        .collect();
    assert_eq!(names, expected);

    assert_round_trip::<TaskToken>(&models["task_token"], "task_token");
    assert_round_trip::<WatchChangedPayload>(&models["watch_changed"], "watch_changed");
    assert_round_trip::<DiagnosticsBundle>(&models["diagnostics_bundle"], "diagnostics_bundle");
}

#[test]
fn required_fields_are_not_accepted_when_missing() {
    // A guard against over-eager defaults: dropping a required contract field
    // must fail deserialization rather than silently producing a partial model.
    let document: Result<DocumentSnapshot, _> = serde_json::from_value(json!({
        "docId": "d-3f79bb7b435b0532",
        "identity": {},
        "text": "",
        "lineCount": 0
    }));
    assert!(document.is_err(), "DocumentSnapshot.version is required");

    let grant: Result<GrantRecord, _> = serde_json::from_value(json!({
        "grantId": "g-1a2b3c4d5e6f7081",
        "kind": "file",
        "scope": "persistent"
    }));
    assert!(grant.is_err(), "GrantRecord.grantedAtMs is required");
}
