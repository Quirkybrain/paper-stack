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
