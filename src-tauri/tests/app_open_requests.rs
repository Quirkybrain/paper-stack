//! Startup arguments and single-instance queueing tests for `services/app.rs`
//! (T-16; contracts §2.1 command 35, §4 `open-requested`).

use paperstack_lib::models::OpenSource;
use paperstack_lib::services::app::{AppService, SecondInstanceDisposition};

fn argv(items: &[&str]) -> Vec<String> {
    items.iter().map(|item| (*item).to_owned()).collect()
}

#[test]
fn paths_from_args_skips_program_and_flags() {
    let args = argv(&[
        "/usr/bin/paperstack",
        "a.md",
        "--flag",
        "b.markdown",
        "-x",
        "--",
        "-weird.md",
    ]);
    assert_eq!(
        AppService::paths_from_args(&args),
        vec!["a.md", "b.markdown", "-weird.md"]
    );
    assert!(AppService::paths_from_args(&argv(&["/usr/bin/paperstack"])).is_empty());
    assert!(AppService::paths_from_args(&argv(&["/usr/bin/paperstack", "--only-flag"])).is_empty());
}

#[test]
fn startup_queue_drains_exactly_once() {
    let mut app = AppService::new();
    assert!(app.queue_startup(
        &argv(&["paperstack", "notes/a.md", "notes/b.md"]),
        Some("/tmp")
    ));
    assert_eq!(app.pending_count(), 1);
    assert!(!app.has_drained());

    let drained = app.take_pending_open_requests();
    assert_eq!(drained.len(), 1);
    assert_eq!(drained[0].paths, vec!["notes/a.md", "notes/b.md"]);
    assert_eq!(drained[0].cwd.as_deref(), Some("/tmp"));
    assert_eq!(drained[0].source, OpenSource::Cli);

    assert!(app.has_drained());
    assert!(app.take_pending_open_requests().is_empty());
    assert_eq!(app.pending_count(), 0);
}

#[test]
fn startup_without_paths_is_not_queued() {
    let mut app = AppService::new();
    assert!(!app.queue_startup(&argv(&["paperstack", "--version"]), None));
    assert_eq!(app.pending_count(), 0);
    assert!(app.take_pending_open_requests().is_empty());
}

#[test]
fn empty_cwd_is_normalized_to_null() {
    let mut app = AppService::new();
    assert!(app.queue_startup(&argv(&["paperstack", "a.md"]), Some("")));
    let drained = app.take_pending_open_requests();
    assert_eq!(drained[0].cwd, None);

    let request =
        AppService::request_from_args(&argv(&["paperstack", "a.md"]), Some(""), OpenSource::Cli)
            .unwrap();
    assert_eq!(request.cwd, None);
}

#[test]
fn second_instance_before_drain_is_queued_with_startup_requests() {
    let mut app = AppService::new();
    app.queue_startup(&argv(&["paperstack", "startup.md"]), Some("/work"));

    let disposition =
        app.handle_second_instance(&argv(&["paperstack", "second.md"]), Some("/work/sub"));
    match disposition {
        SecondInstanceDisposition::Queued(request) => {
            assert_eq!(request.paths, vec!["second.md"]);
            assert_eq!(request.source, OpenSource::SecondInstance);
        }
        other => panic!("expected Queued, got {other:?}"),
    }

    let drained = app.take_pending_open_requests();
    assert_eq!(drained.len(), 2);
    assert_eq!(drained[0].source, OpenSource::Cli);
    assert_eq!(drained[1].source, OpenSource::SecondInstance);
}

#[test]
fn second_instance_after_drain_is_delivered_as_event() {
    let mut app = AppService::new();
    assert!(app.take_pending_open_requests().is_empty());

    let disposition = app.handle_second_instance(&argv(&["paperstack", "late.md"]), Some("/work"));
    match disposition {
        SecondInstanceDisposition::Deliver(request) => {
            assert_eq!(request.paths, vec!["late.md"]);
            assert_eq!(request.cwd.as_deref(), Some("/work"));
            assert_eq!(request.source, OpenSource::SecondInstance);
        }
        other => panic!("expected Deliver, got {other:?}"),
    }
    assert_eq!(app.pending_count(), 0);
}

#[test]
fn second_instance_without_paths_is_ignored() {
    let mut app = AppService::new();
    let disposition = app.handle_second_instance(&argv(&["paperstack", "--flag"]), None);
    assert_eq!(disposition, SecondInstanceDisposition::Ignored);
    assert_eq!(app.pending_count(), 0);
}
