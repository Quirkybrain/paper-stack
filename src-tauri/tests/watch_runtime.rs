//! Real-notify wiring test for `WatchRuntime` (T-15): events flow from the OS
//! watcher through W1 to the emitter, and unwatch silences further payloads.
//! The debounce state machine itself is covered deterministically in
//! `watch_registry.rs`; this test only checks the production wiring.

use std::fs;
use std::sync::mpsc;
use std::time::Duration;

use paperstack_lib::models::WatchKind;
use paperstack_lib::services::watch::{WatchConfig, WatchRuntime};
use tempfile::TempDir;

#[test]
fn runtime_delivers_events_and_stays_silent_after_unwatch() {
    let temp = TempDir::new().unwrap();
    let doc = temp.path().join("doc.md");
    fs::write(&doc, "# one\n").unwrap();

    let (tx, rx) = mpsc::channel();
    let runtime = WatchRuntime::start(
        WatchConfig {
            quiet_window: Duration::from_millis(40),
        },
        move |payload| {
            let _ = tx.send(payload);
        },
    )
    .unwrap();
    runtime.watch_document("d-runtime", &doc, &[]).unwrap();

    fs::write(&doc, "# two longer\n").unwrap();
    let payload = rx
        .recv_timeout(Duration::from_secs(10))
        .expect("a watch payload must arrive");
    assert_eq!(payload.doc_id, "d-runtime");
    assert!(matches!(
        payload.kind,
        WatchKind::Modified | WatchKind::Appeared
    ));

    // Let any trailing payload of the same busy write settle, then drain.
    std::thread::sleep(Duration::from_millis(120));
    while rx.try_recv().is_ok() {}

    runtime.unwatch_document("d-runtime").unwrap();
    fs::write(&doc, "# three\n").unwrap();
    assert!(
        rx.recv_timeout(Duration::from_millis(500)).is_err(),
        "no payload may be emitted after unwatch"
    );

    runtime.shutdown();
}

#[test]
fn runtime_shutdown_removes_watches_and_reports_missing_paths() {
    let temp = TempDir::new().unwrap();
    let missing = temp.path().join("missing.md");
    let runtime = WatchRuntime::start(WatchConfig::default(), |_payload| {}).unwrap();
    let error = runtime
        .watch_document("d-missing", &missing, &[])
        .unwrap_err();
    assert_eq!(error.code(), paperstack_lib::error::ErrorCode::IoNotFound);
    runtime.shutdown();
}

/// D-IT-2 regression on the production wiring (real notify + real
/// filesystem): an editor-style replacement save (`copyfile` + `rename over`,
/// the IT03 repro) must not surface as `removed`, and the document keeps being
/// watched for later in-place writes; a real deletion still reports `removed`.
#[test]
fn runtime_replacement_save_is_not_removed_and_keeps_watching() {
    let temp = TempDir::new().unwrap();
    let doc = temp.path().join("doc.md");
    fs::write(&doc, "# v1\n").unwrap();

    let (tx, rx) = mpsc::channel();
    let runtime = WatchRuntime::start(
        WatchConfig {
            quiet_window: Duration::from_millis(120),
        },
        move |payload| {
            let _ = tx.send(payload);
        },
    )
    .unwrap();
    runtime.watch_document("d-replace", &doc, &[]).unwrap();
    std::thread::sleep(Duration::from_millis(200));

    // Replacement save: write a temp file next to the document, rename over.
    let tmp = temp.path().join("doc.md.external-new");
    fs::write(&tmp, "# v2\nreplacement save body, longer\n").unwrap();
    fs::rename(&tmp, &doc).unwrap();

    let payload = rx
        .recv_timeout(Duration::from_secs(10))
        .expect("a payload for the replacement save");
    assert_eq!(payload.doc_id, "d-replace");
    assert_ne!(
        payload.kind,
        WatchKind::Removed,
        "rename-over must never be reported as a removal while the file exists"
    );
    assert!(matches!(
        payload.kind,
        WatchKind::Modified | WatchKind::Appeared
    ));
    // Let the same busy window settle and drain; no stale `removed` may follow.
    std::thread::sleep(Duration::from_millis(250));
    while rx.try_recv().is_ok() {}
    assert!(
        rx.recv_timeout(Duration::from_millis(400)).is_err(),
        "no late removed payload for a replacement save"
    );

    // The replaced document stays watched: an in-place write must surface.
    fs::write(&doc, "# v3\nin-place body after replacement\n").unwrap();
    let payload = rx
        .recv_timeout(Duration::from_secs(10))
        .expect("a payload for the in-place write after replacement");
    assert!(matches!(
        payload.kind,
        WatchKind::Modified | WatchKind::Appeared
    ));
    std::thread::sleep(Duration::from_millis(250));
    while rx.try_recv().is_ok() {}

    // A genuine deletion is still a removal (checked against the filesystem).
    fs::remove_file(&doc).unwrap();
    let payload = rx
        .recv_timeout(Duration::from_secs(10))
        .expect("a payload for the deletion");
    assert_eq!(payload.kind, WatchKind::Removed);

    runtime.shutdown();
}
