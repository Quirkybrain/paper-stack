//! Single-instance open-request queueing and startup arguments (contracts
//! §2.1 command 35, §4 `paperstack://open-requested`; T-16).
//!
//! Startup arguments and second-instance handovers enter through one queue.
//! The frontend drains it exactly once with `take_pending_open_requests`;
//! after that first drain, later second-instance requests are delivered as
//! `paperstack://open-requested` events instead of being queued (contracts
//! §2.1 command 35, §4).
//!
//! The service is pure and testable: argument parsing, queue ordering, drain
//! semantics and the queue-vs-event decision take plain `argv`/`cwd` values.

use std::collections::VecDeque;

use crate::models::{OpenRequest, OpenSource};

/// `paperstack://open-requested` event name (contracts §4).
pub const EVENT_OPEN_REQUESTED: &str = "paperstack://open-requested";

/// What the single-instance callback should do with a second-instance
/// handover (`tauri_plugin_single_instance` callback args and cwd).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecondInstanceDisposition {
    /// No positional path arguments: nothing to open.
    Ignored,
    /// The frontend has not drained the startup queue yet; the request is
    /// queued and will be returned by `take_pending_open_requests`.
    Queued(OpenRequest),
    /// The startup queue was already drained; the caller must emit
    /// `paperstack://open-requested` with this payload.
    Deliver(OpenRequest),
}

/// Startup/second-instance open-request queue (contracts §2.1 command 35).
#[derive(Debug, Default)]
pub struct AppService {
    pending: VecDeque<OpenRequest>,
    drained: bool,
}

impl AppService {
    pub fn new() -> Self {
        Self::default()
    }

    /// Positional paths in `argv` (including the executable at index 0):
    /// arguments that are not `-`-prefixed flags; `--` ends flag parsing.
    pub fn paths_from_args(args: &[String]) -> Vec<String> {
        let mut paths = Vec::new();
        let mut after_separator = false;
        for arg in args.iter().skip(1) {
            if !after_separator && arg == "--" {
                after_separator = true;
                continue;
            }
            if !after_separator && arg.starts_with('-') {
                continue;
            }
            paths.push(arg.clone());
        }
        paths
    }

    /// Builds one `OpenRequest` from `argv`/`cwd`, or `None` without paths.
    /// `source` is `cli` for startup arguments and `second-instance` for the
    /// single-instance plugin handover (contracts §3.7).
    pub fn request_from_args(
        args: &[String],
        cwd: Option<&str>,
        source: OpenSource,
    ) -> Option<OpenRequest> {
        let paths = Self::paths_from_args(args);
        if paths.is_empty() {
            return None;
        }
        Some(OpenRequest {
            paths,
            cwd: normalize_cwd(cwd),
            source,
        })
    }

    /// Queues startup (CLI/system open) arguments; `false` when `argv`
    /// carries no path.
    pub fn queue_startup(&mut self, args: &[String], cwd: Option<&str>) -> bool {
        match Self::request_from_args(args, cwd, OpenSource::Cli) {
            Some(request) => {
                self.pending.push_back(request);
                true
            }
            None => false,
        }
    }

    /// Handles a second-instance callback handover (contracts §4).
    pub fn handle_second_instance(
        &mut self,
        args: &[String],
        cwd: Option<&str>,
    ) -> SecondInstanceDisposition {
        let Some(request) = Self::request_from_args(args, cwd, OpenSource::SecondInstance) else {
            return SecondInstanceDisposition::Ignored;
        };
        if self.drained {
            SecondInstanceDisposition::Deliver(request)
        } else {
            self.pending.push_back(request.clone());
            SecondInstanceDisposition::Queued(request)
        }
    }

    /// `take_pending_open_requests`: drains the queue in arrival order and
    /// marks the frontend as ready, so later requests are delivered as
    /// events. Subsequent calls return an empty vector.
    pub fn take_pending_open_requests(&mut self) -> Vec<OpenRequest> {
        self.drained = true;
        self.pending.drain(..).collect()
    }

    pub fn pending_count(&self) -> usize {
        self.pending.len()
    }

    /// `true` once the frontend has drained the startup queue.
    pub fn has_drained(&self) -> bool {
        self.drained
    }
}

fn normalize_cwd(cwd: Option<&str>) -> Option<String> {
    cwd.filter(|value| !value.is_empty()).map(str::to_owned)
}
