//! NF07 stability soak, service level (T-62; requirements NF07).
//!
//! 500 open → refresh → close(switch) cycles over two deterministic documents
//! through `FilesService`, the same service the Tauri commands call. The
//! contracts have no "close document" command (tab close is front-end state;
//! the server side drops work through generation invalidation and falls out of
//! the snapshot cache), so a cycle pair opens the other document to force the
//! LRU eviction that releases the decoded text — the service's only text-buffer
//! lifetime mechanism — and the test asserts the cache/registration bounds
//! instead of pretending a close verb exists.
//!
//! Trend sampling every 50 cycles records resident memory (`/proc/self/
//! smaps_rollup`), open file descriptors (`/proc/self/fd`, the handle trend),
//! and registered/snapshot counts. Samples are printed with the `NF07_SAMPLE`
//! prefix and appended to `$PS_NF07_OUT` when set, so the wp-32 report can cite
//! raw data. No threshold is claimed as a product budget (calibration run).

use std::fs;
use std::time::Duration;

use paperstack_lib::models::{ReadPurpose, SearchSourceRequest};
use paperstack_lib::services::files::{FilesConfig, FilesService, StabilityTimer};
use tempfile::TempDir;

const CYCLES: usize = 500;
const SAMPLE_EVERY: usize = 50;
const DOC_LINES: usize = 600;

/// Instant stability timer: the soak measures lifetime/handle trends, not the
/// calibrated S1 window (which keeps its own tests).
#[derive(Debug, Default)]
struct NoWaitTimer;

impl StabilityTimer for NoWaitTimer {
    fn now_ms(&self) -> i64 {
        0
    }
    fn wait_stability_window(&self, _window: Duration) {}
}

fn document_body(label: &str, needle: &str) -> String {
    let mut text = format!("# Soak document {label}\n\n中文压力文段 {label}。\n\n");
    for index in 0..DOC_LINES {
        if index % 7 == 0 {
            text.push_str(&format!("- 行 {index} with {needle} 标记\n"));
        } else {
            text.push_str(&format!(
                "Paragraph {index} {label}: mixed CN 中文 / EN payload for the soak loop.\n"
            ));
        }
    }
    text
}

fn rss_kb() -> u64 {
    let raw = fs::read_to_string("/proc/self/smaps_rollup").unwrap_or_default();
    for line in raw.lines() {
        if let Some(value) = line.strip_prefix("Rss:") {
            return value.trim().trim_end_matches(" kB").trim().parse().unwrap_or(0);
        }
    }
    0
}

fn fd_count() -> u64 {
    fs::read_dir("/proc/self/fd")
        .map(|entries| entries.count() as u64)
        .unwrap_or(0)
}

fn record(cycle: usize, samples: &mut String, out_path: &Option<String>) {
    let line = format!(
        "NF07_SAMPLE cycle={cycle} rss_kb={} fds={}\n",
        rss_kb(),
        fd_count()
    );
    print!("{line}");
    samples.push_str(&line);
    if let Some(path) = out_path {
        let _ = fs::write(path, samples);
    }
}

#[test]
fn nf07_five_hundred_open_refresh_switch_cycles_stay_bounded() {
    let temp = TempDir::new().unwrap();
    let path_a = temp.path().join("soak-a.md");
    let path_b = temp.path().join("soak-b.md");
    let body_a = document_body("A", "针A");
    let body_b = document_body("B", "针B");
    fs::write(&path_a, &body_a).unwrap();
    fs::write(&path_b, &body_b).unwrap();
    assert!(body_a.len() > 24 * 1024, "keep the soak payloads meaningful");

    let config = FilesConfig {
        snapshot_cache_capacity: 1,
        ..FilesConfig::default()
    };
    let mut service = FilesService::with_timer(config, Box::new(NoWaitTimer));
    let out_path = std::env::var("PS_NF07_OUT").ok();
    let mut samples = String::new();

    let mut first_fd_window: Option<u64> = None;
    let mut first_rss = 0u64;
    let started = std::time::Instant::now();

    for cycle in 0..CYCLES {
        let (path, needle, expected_hash) = if cycle % 2 == 0 {
            (&path_a, "针A", paperstack_lib::services::files::sha256_hex(body_a.as_bytes()))
        } else {
            (&path_b, "针B", paperstack_lib::services::files::sha256_hex(body_b.as_bytes()))
        };

        let opened = service.open_document(&path.to_string_lossy()).unwrap();
        assert!(!opened.source_only, "soak documents are full-read sized");

        let initial = service.read_document(&opened.doc_id, ReadPurpose::Initial).unwrap();
        assert_eq!(initial.version.content_hash, expected_hash, "cycle {cycle}");

        let refreshed = service
            .read_document(&opened.doc_id, ReadPurpose::Refresh)
            .unwrap();
        assert_eq!(
            refreshed.version.content_hash, expected_hash,
            "cycle {cycle} refresh must not change the version"
        );

        let search = service
            .search_source(&SearchSourceRequest {
                doc_id: opened.doc_id.clone(),
                query: needle.to_owned(),
                case_sensitive: true,
                max_results: 10_000,
            })
            .unwrap();
        assert!(search.complete, "cycle {cycle} search must be complete");
        assert!(
            !search.matches.is_empty(),
            "cycle {cycle} needle must be found"
        );

        // "Close" of the previous document = the next open plus the LRU bound.
        assert!(service.registered_count() <= 2, "cycle {cycle}");
        assert!(
            service.cached_snapshot_count() <= 1,
            "cycle {cycle}: snapshot cache exceeded its configured capacity"
        );

        if cycle % SAMPLE_EVERY == 0 {
            record(cycle, &mut samples, &out_path);
            let fd = fd_count();
            let rss = rss_kb();
            if cycle == 0 {
                first_fd_window = Some(fd);
                first_rss = rss;
            }
        }
    }

    record(CYCLES, &mut samples, &out_path);
    let last_fd = fd_count();
    let last_rss = rss_kb();
    let elapsed = started.elapsed();
    println!(
        "NF07_SUMMARY cycles={CYCLES} elapsed_ms={} rss_kb_first={first_rss} rss_kb_last={last_rss}",
        elapsed.as_millis()
    );

    // Handle trend: no growth beyond normal harness noise (a leak would add
    // one descriptor per cycle; the bound trips long before 500).
    let first_fd = first_fd_window.expect("first fd window");
    assert!(
        last_fd <= first_fd + 16,
        "file descriptor trend grew: first={first_fd} last={last_fd}"
    );

    // Memory trend: a per-cycle retention of either document would add tens of
    // MiB over 500 cycles; the bound is deliberately generous against allocator
    // noise and is a trend guard, not a product budget (calibration run).
    assert!(
        last_rss <= first_rss + 16 * 1024,
        "resident memory trend grew: first={first_rss} kB last={last_rss} kB"
    );
}
