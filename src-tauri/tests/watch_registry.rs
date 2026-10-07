//! Deterministic watch-registry tests for `services/watch.rs` (T-15):
//! W1 debounce/merge counts with an injectable clock, replacement-save
//! detection (rename-over), resource invalidation, unwatch silence/no leaks,
//! content-free payloads and the focus-re-check helpers.

use std::collections::{BTreeSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::event::{
    CreateKind, DataChange, EventAttributes, EventKind, MetadataKind, ModifyKind, RemoveKind,
    RenameMode,
};
use notify::Event;
use paperstack_lib::error::{AppError, ErrorCode};
use paperstack_lib::models::WatchKind;
use paperstack_lib::services::watch::{
    focus_recheck_action, focus_recheck_due, stat_observation, FocusRecheckAction,
    ManualWatchTimer, StatObservation, WatchBackend, WatchConfig, WatchService,
    FOCUS_RECHECK_THROTTLE,
};
use tempfile::TempDir;

// ---------------------------------------------------------------------------
// Mocks and fixtures
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
struct BackendState {
    watched: BTreeSet<PathBuf>,
    watch_calls: usize,
    unwatch_calls: usize,
    fail_on: Option<PathBuf>,
}

#[derive(Debug)]
struct MockBackend {
    state: Arc<Mutex<BackendState>>,
}

impl MockBackend {
    fn new() -> (Self, Arc<Mutex<BackendState>>) {
        let state = Arc::new(Mutex::new(BackendState::default()));
        (
            Self {
                state: state.clone(),
            },
            state,
        )
    }
}

impl WatchBackend for MockBackend {
    fn watch_path(&mut self, path: &Path) -> Result<(), AppError> {
        let mut state = self.state.lock().unwrap();
        state.watch_calls += 1;
        if state.fail_on.as_deref() == Some(path) {
            return Err(AppError::new(ErrorCode::Internal).with_message("mock watch failure"));
        }
        state.watched.insert(path.to_path_buf());
        Ok(())
    }

    fn unwatch_path(&mut self, path: &Path) -> Result<(), AppError> {
        let mut state = self.state.lock().unwrap();
        state.unwatch_calls += 1;
        state.watched.remove(path);
        Ok(())
    }
}

struct Fixture {
    _temp: TempDir,
    doc: PathBuf,
    resource: PathBuf,
    other_resource: PathBuf,
}

fn fixture() -> Fixture {
    let temp = TempDir::new().unwrap();
    let doc = temp.path().join("doc.md");
    let resource = temp.path().join("img.png");
    let nested = temp.path().join("assets");
    std::fs::create_dir_all(&nested).unwrap();
    let other_resource = nested.join("other.png");
    std::fs::write(&doc, "# one\n").unwrap();
    std::fs::write(&resource, [0u8, 1, 2, 3]).unwrap();
    std::fs::write(&other_resource, [4u8, 5, 6]).unwrap();
    Fixture {
        _temp: temp,
        doc,
        resource,
        other_resource,
    }
}

fn event(kind: EventKind, paths: Vec<PathBuf>) -> Event {
    Event {
        kind,
        paths,
        attrs: EventAttributes::new(),
    }
}

fn modify() -> EventKind {
    EventKind::Modify(ModifyKind::Data(DataChange::Any))
}

fn window() -> Duration {
    Duration::from_millis(300)
}

fn service(clock: &ManualWatchTimer, backend: MockBackend) -> WatchService {
    WatchService::with_timer(
        WatchConfig {
            quiet_window: window(),
        },
        Box::new(clock.clone()),
        Box::new(backend),
    )
}

fn path_str(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

// ---------------------------------------------------------------------------
// Debounce/merge
// ---------------------------------------------------------------------------

#[test]
fn quiet_window_merges_events_and_resets_on_new_events() {
    let fixture = fixture();
    let (backend, backend_state) = MockBackend::new();
    let clock = ManualWatchTimer::new(1_000);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    // Two modify hints inside W1, resetting the window.
    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    clock.advance(Duration::from_millis(200));
    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    clock.advance(Duration::from_millis(299));
    assert!(service.flush_due().is_empty());
    clock.advance(Duration::from_millis(1));
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1, "one payload per quiet window");
    assert_eq!(payloads[0].doc_id, "d-1");
    assert_eq!(payloads[0].kind, WatchKind::Modified);
    assert!(service.flush_due().is_empty(), "payloads are not repeated");

    // A new event after the window opens a fresh window/payload.
    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    assert_eq!(service.pending_count(), 1);
    assert_eq!(service.next_flush_delay(), Some(window()));
    clock.advance(Duration::from_millis(300));
    assert_eq!(service.flush_due().len(), 1);

    // ~5 events, 2 payloads: the merge count is bounded by windows.
    assert_eq!(backend_state.lock().unwrap().watch_calls, 2);
    assert_eq!(backend_state.lock().unwrap().watched.len(), 2);
}

#[test]
fn unrelated_paths_do_not_disturb_the_window() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    let unrelated = fixture.doc.parent().unwrap().join("other.md");
    service.handle_notify_event(&event(modify(), vec![unrelated]));
    clock.advance(window());
    assert!(service.flush_due().is_empty());
    assert_eq!(service.pending_count(), 0);
}

// ---------------------------------------------------------------------------
// Replacement-save detection
// ---------------------------------------------------------------------------

#[test]
fn rename_over_replacement_save_reports_appeared() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    // Editor writes a temp file and renames it over the document: notify
    // reports (from, to) with the document as the target.
    let temp_name = fixture.doc.parent().unwrap().join(".doc.md.tmp");
    service.handle_notify_event(&event(
        EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
        vec![temp_name, fixture.doc.clone()],
    ));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0].kind, WatchKind::Appeared);
    assert!(payloads[0].resource_path.is_none());
}

#[test]
fn remove_then_create_in_one_window_is_a_replacement_save() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    service.handle_notify_event(&event(
        EventKind::Remove(RemoveKind::File),
        vec![fixture.doc.clone()],
    ));
    // The window is not flushed yet: the reappearance must win.
    service.handle_notify_event(&event(
        EventKind::Create(CreateKind::File),
        vec![fixture.doc.clone()],
    ));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0].kind, WatchKind::Appeared);
}

#[test]
fn removal_without_reappearance_reports_removed() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    service.handle_notify_event(&event(
        EventKind::Remove(RemoveKind::File),
        vec![fixture.doc.clone()],
    ));
    // The removal hint is checked against the settled filesystem at flush:
    // a path that is really gone is `removed`.
    std::fs::remove_file(&fixture.doc).unwrap();
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0].kind, WatchKind::Removed);
}

#[test]
fn removal_that_is_a_replacement_save_reports_modified_at_flush() {
    // D-IT-2 regression: the notify stream of `write temp + rename over` ends
    // with the *old inode's* removal event after the appearance hints
    // (empirically: Modify(Name(Both)) → Modify(Metadata) → Remove(File)).
    // "Last operation wins" alone reported `removed` for a document that
    // exists again, bouncing the tab into the source-unavailable state.
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    let temp_name = fixture.doc.parent().unwrap().join(".doc.md.tmp");
    for event in [
        event(
            EventKind::Modify(ModifyKind::Name(RenameMode::From)),
            vec![temp_name.clone()],
        ),
        event(
            EventKind::Modify(ModifyKind::Name(RenameMode::To)),
            vec![fixture.doc.clone()],
        ),
        event(
            EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            vec![temp_name, fixture.doc.clone()],
        ),
        event(
            EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any)),
            vec![fixture.doc.clone()],
        ),
        event(
            EventKind::Remove(RemoveKind::File),
            vec![fixture.doc.clone()],
        ),
    ] {
        service.handle_notify_event(&event);
    }

    // The replaced file exists at flush time (the fixture file is untouched);
    // the settled hint must be a change, never "missing".
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0].kind, WatchKind::Modified);
}

#[test]
fn last_observed_operation_wins_inside_a_window() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    // modified then removed: the final state is missing → removed.
    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    service.handle_notify_event(&event(
        EventKind::Remove(RemoveKind::File),
        vec![fixture.doc.clone()],
    ));
    std::fs::remove_file(&fixture.doc).unwrap();
    clock.advance(window());
    assert_eq!(service.flush_due()[0].kind, WatchKind::Removed);
}

#[test]
fn flush_time_presence_probe_decides_removed_vs_modified() {
    // Deterministic seam, no real filesystem dependency: the injected probe
    // is the only authority for the removed hint.
    #[derive(Debug)]
    struct Presence(bool);
    impl paperstack_lib::services::watch::DocPresence for Presence {
        fn exists(&self, _path: &Path) -> bool {
            self.0
        }
    }

    for (present, expected) in [(true, WatchKind::Modified), (false, WatchKind::Removed)] {
        let fixture = fixture();
        let (backend, _state) = MockBackend::new();
        let clock = ManualWatchTimer::new(0);
        let mut service = WatchService::with_timer_and_presence(
            WatchConfig {
                quiet_window: window(),
            },
            Box::new(clock.clone()),
            Box::new(backend),
            Box::new(Presence(present)),
        );
        service.watch_document("d-1", &fixture.doc, &[]).unwrap();
        service.handle_notify_event(&event(
            EventKind::Remove(RemoveKind::File),
            vec![fixture.doc.clone()],
        ));
        clock.advance(window());
        let payloads = service.flush_due();
        assert_eq!(payloads.len(), 1);
        assert_eq!(payloads[0].kind, expected, "present={present}");
    }
}

// ---------------------------------------------------------------------------
// Resource invalidation
// ---------------------------------------------------------------------------

#[test]
fn resource_change_reports_resource_kind_with_registered_path() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service
        .watch_document("d-1", &fixture.doc, &[path_str(&fixture.resource)])
        .unwrap();

    service.handle_notify_event(&event(modify(), vec![fixture.resource.clone()]));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0].kind, WatchKind::Resource);
    assert_eq!(
        payloads[0].resource_path.as_deref(),
        Some(path_str(&fixture.resource).as_str())
    );
}

#[test]
fn resource_removal_still_reports_resource_kind() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service
        .watch_document("d-1", &fixture.doc, &[path_str(&fixture.resource)])
        .unwrap();

    service.handle_notify_event(&event(
        EventKind::Remove(RemoveKind::File),
        vec![fixture.resource.clone()],
    ));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads[0].kind, WatchKind::Resource);
}

#[test]
fn most_recent_resource_change_is_reported_once() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service
        .watch_document(
            "d-1",
            &fixture.doc,
            &[
                path_str(&fixture.resource),
                path_str(&fixture.other_resource),
            ],
        )
        .unwrap();

    service.handle_notify_event(&event(modify(), vec![fixture.resource.clone()]));
    service.handle_notify_event(&event(modify(), vec![fixture.other_resource.clone()]));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(
        payloads[0].resource_path.as_deref(),
        Some(path_str(&fixture.other_resource).as_str())
    );
}

#[test]
fn document_change_takes_precedence_over_resource_change_in_one_window() {
    let fixture = fixture();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service
        .watch_document("d-1", &fixture.doc, &[path_str(&fixture.resource)])
        .unwrap();

    service.handle_notify_event(&event(modify(), vec![fixture.resource.clone()]));
    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);
    assert_eq!(payloads[0].kind, WatchKind::Modified);
    assert!(payloads[0].resource_path.is_none());
}

// ---------------------------------------------------------------------------
// Unwatch, leaks and registration replacement
// ---------------------------------------------------------------------------

#[test]
fn unwatch_removes_registration_and_silences_future_events() {
    let fixture = fixture();
    let (backend, backend_state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service
        .watch_document(
            "d-1",
            &fixture.doc,
            &[
                path_str(&fixture.resource),
                path_str(&fixture.other_resource),
            ],
        )
        .unwrap();
    let watched_paths = backend_state.lock().unwrap().watched.len();
    assert!(watched_paths >= 4, "doc + parent + resources + parents");

    service.unwatch_document("d-1");
    assert!(!service.is_watched("d-1"));
    assert_eq!(service.document_count(), 0);
    assert_eq!(service.watched_path_count(), 0);
    assert!(
        backend_state.lock().unwrap().watched.is_empty(),
        "no backend watch may leak after unwatch"
    );

    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    clock.advance(Duration::from_secs(5));
    assert!(service.flush_due().is_empty(), "no events after unwatch");

    // Unwatching an unknown document is a no-op success (contracts §1.7).
    service.unwatch_document("d-unknown");
    assert_eq!(backend_state.lock().unwrap().unwatch_calls, watched_paths);
}

#[test]
fn shared_parent_directory_is_refcounted_across_documents() {
    let temp = TempDir::new().unwrap();
    let doc_one = temp.path().join("one.md");
    let doc_two = temp.path().join("two.md");
    std::fs::write(&doc_one, "# one\n").unwrap();
    std::fs::write(&doc_two, "# two\n").unwrap();

    let (backend, backend_state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &doc_one, &[]).unwrap();
    service.watch_document("d-2", &doc_two, &[]).unwrap();

    // Shared parent + two document files = three unique backend watches.
    assert_eq!(backend_state.lock().unwrap().watched.len(), 3);

    service.unwatch_document("d-1");
    assert_eq!(
        backend_state.lock().unwrap().watched.len(),
        2,
        "parent stays watched for the other document"
    );
    assert_eq!(service.watched_path_count(), 2);

    service.unwatch_document("d-2");
    assert!(backend_state.lock().unwrap().watched.is_empty());
}

#[test]
fn rewatch_replaces_the_resource_set_without_leaking_paths() {
    let fixture = fixture();
    let (backend, backend_state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service
        .watch_document("d-1", &fixture.doc, &[path_str(&fixture.resource)])
        .unwrap();
    service
        .watch_document("d-1", &fixture.doc, &[path_str(&fixture.other_resource)])
        .unwrap();

    let state = backend_state.lock().unwrap();
    assert!(state.watched.contains(&fixture.other_resource));
    assert!(!state.watched.contains(&fixture.resource));
    assert!(state.watched.contains(&fixture.doc));
    drop(state);
    assert_eq!(service.document_count(), 1);
}

#[test]
fn backend_failure_rolls_back_and_keeps_previous_registration() {
    let fixture = fixture();
    let (backend, backend_state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();
    let watched_before = backend_state.lock().unwrap().watched.clone();

    // Re-registering d-1 with a resource whose watch registration fails must
    // leave the previous registration untouched.
    backend_state.lock().unwrap().fail_on = Some(fixture.resource.clone());
    let error = service
        .watch_document("d-1", &fixture.doc, &[path_str(&fixture.resource)])
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::Internal);
    assert_eq!(
        backend_state.lock().unwrap().watched,
        watched_before,
        "failed registration must not leak watches"
    );
    assert!(service.is_watched("d-1"));
    assert!(service.flush_due().is_empty());
}

#[test]
fn missing_document_or_resource_is_not_registered() {
    let fixture = fixture();
    let (backend, backend_state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);

    let missing_doc = fixture.doc.parent().unwrap().join("missing.md");
    let error = service
        .watch_document("d-1", &missing_doc, &[])
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoNotFound);

    let missing_resource = path_str(&fixture.doc.parent().unwrap().join("missing.png"));
    let error = service
        .watch_document("d-1", &fixture.doc, &[missing_resource])
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoNotFound);

    assert_eq!(service.document_count(), 0);
    assert!(backend_state.lock().unwrap().watched.is_empty());
}

// ---------------------------------------------------------------------------
// Privacy: payloads never carry content
// ---------------------------------------------------------------------------

#[test]
fn payload_serialization_contains_no_document_content() {
    const SENTINEL: &str = "SENTINEL-DOCUMENT-CONTENT-42";
    let fixture = fixture();
    std::fs::write(&fixture.doc, format!("# {SENTINEL}\n")).unwrap();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-1", &fixture.doc, &[]).unwrap();

    service.handle_notify_event(&event(modify(), vec![fixture.doc.clone()]));
    clock.advance(window());
    let payloads = service.flush_due();
    assert_eq!(payloads.len(), 1);

    let json = serde_json::to_string(&payloads[0]).unwrap();
    assert!(
        !json.contains(SENTINEL),
        "watch payload must never carry document content"
    );
    let value: serde_json::Value = serde_json::from_str(&json).unwrap();
    let keys: BTreeSet<&str> = value
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(
        keys,
        BTreeSet::from(["docId", "kind", "observedAtMs"]),
        "payload shape is exactly {{docId, kind, resourcePath?, observedAtMs}}"
    );
}

// ---------------------------------------------------------------------------
// Focus re-check helpers (contracts §7.5)
// ---------------------------------------------------------------------------

#[test]
fn focus_recheck_actions_compare_stat_against_last_observation() {
    let observed = StatObservation {
        size_bytes: 100,
        modified_at_ms: 5_000,
    };
    assert_eq!(
        focus_recheck_action(Some(observed), Some(observed)),
        FocusRecheckAction::InSync
    );
    assert_eq!(
        focus_recheck_action(
            Some(StatObservation {
                size_bytes: 101,
                ..observed
            }),
            Some(observed)
        ),
        FocusRecheckAction::StableRead
    );
    assert_eq!(
        focus_recheck_action(
            Some(StatObservation {
                modified_at_ms: 5_001,
                ..observed
            }),
            Some(observed)
        ),
        FocusRecheckAction::StableRead
    );
    assert_eq!(
        focus_recheck_action(None, Some(observed)),
        FocusRecheckAction::Missing
    );
    assert_eq!(
        focus_recheck_action(Some(observed), None),
        FocusRecheckAction::StableRead
    );
}

#[test]
fn focus_recheck_throttle_is_injectable() {
    assert!(focus_recheck_due(1_000, None, FOCUS_RECHECK_THROTTLE));
    assert!(!focus_recheck_due(
        1_100,
        Some(1_000),
        FOCUS_RECHECK_THROTTLE
    ));
    assert!(focus_recheck_due(
        1_300,
        Some(1_000),
        FOCUS_RECHECK_THROTTLE
    ));
}

#[test]
fn stat_observation_reflects_the_filesystem() {
    let fixture = fixture();
    let stat = stat_observation(&fixture.doc).unwrap();
    assert_eq!(
        stat.size_bytes,
        std::fs::metadata(&fixture.doc).unwrap().len()
    );
    assert!(stat_observation(&fixture.doc.parent().unwrap().join("missing.md")).is_none());
}

// ---------------------------------------------------------------------------
// Batch/queue sanity
// ---------------------------------------------------------------------------

#[test]
fn pending_windows_are_flushed_in_document_order() {
    let temp = TempDir::new().unwrap();
    let doc_a = temp.path().join("a.md");
    let doc_b = temp.path().join("b.md");
    std::fs::write(&doc_a, "# a\n").unwrap();
    std::fs::write(&doc_b, "# b\n").unwrap();
    let (backend, _state) = MockBackend::new();
    let clock = ManualWatchTimer::new(0);
    let mut service = service(&clock, backend);
    service.watch_document("d-b", &doc_b, &[]).unwrap();
    service.watch_document("d-a", &doc_a, &[]).unwrap();

    let mut queue = VecDeque::new();
    queue.push_back(event(modify(), vec![doc_a]));
    queue.push_back(event(modify(), vec![doc_b]));
    while let Some(event) = queue.pop_front() {
        service.handle_notify_event(&event);
    }
    clock.advance(window());
    let payloads = service.flush_due();
    let ids: Vec<&str> = payloads.iter().map(|p| p.doc_id.as_str()).collect();
    assert_eq!(ids, ["d-a", "d-b"]);
}
