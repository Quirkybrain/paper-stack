//! Remote resource policy vectors (T-17; security-model §4; contracts §2.1
//! command 30): HTTPS-only, resolve-all blocked-address checks, per-hop
//! redirect revalidation (≤3 hops), size/time caps, no automatic retry,
//! session allow-list, revoke/purge cache cleanup and no cross-session
//! reuse. Every transport/resolver/cache is a deterministic mock: no test
//! touches the network.

use std::collections::{BTreeMap, VecDeque};
use std::net::{IpAddr, Ipv4Addr};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use paperstack_lib::error::{AppError, ErrorCode};
use paperstack_lib::models::DetailValue;
use paperstack_lib::services::resources::{
    cache_key_for, is_blocked_address, normalize_origin, origin_allowed, CachePut, CachedImage,
    ManualRemoteClock, RemoteCacheStore, RemoteConfig, RemoteFetch, RemoteHttpOutcome,
    RemoteHttpRequest, RemoteResolver, RemoteService, RemoteTransport, ReqwestTransport,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
struct ResolverState {
    calls: Vec<(String, u16)>,
    responses: VecDeque<Vec<IpAddr>>,
    fallback: Vec<IpAddr>,
}

#[derive(Debug)]
struct ScriptResolver {
    state: Arc<Mutex<ResolverState>>,
}

impl RemoteResolver for ScriptResolver {
    fn resolve(&self, host: &str, port: u16) -> Result<Vec<IpAddr>, AppError> {
        let mut state = self.state.lock().unwrap();
        state.calls.push((host.to_owned(), port));
        Ok(state
            .responses
            .pop_front()
            .unwrap_or_else(|| state.fallback.clone()))
    }
}

#[derive(Debug, Default)]
struct TransportState {
    calls: Vec<RemoteHttpRequest>,
    outcomes: VecDeque<Result<RemoteHttpOutcome, AppError>>,
    clock: Option<ManualRemoteClock>,
    advance_per_call: Option<Duration>,
}

#[derive(Debug)]
struct MockTransport {
    state: Arc<Mutex<TransportState>>,
}

impl RemoteTransport for MockTransport {
    fn fetch(&self, request: &RemoteHttpRequest) -> Result<RemoteHttpOutcome, AppError> {
        let mut state = self.state.lock().unwrap();
        state.calls.push(request.clone());
        if let (Some(clock), Some(advance)) = (state.clock.clone(), state.advance_per_call) {
            clock.advance(advance);
        }
        match state.outcomes.pop_front() {
            Some(outcome) => outcome,
            None => Ok(body("image/png", b"png-bytes")),
        }
    }
}

#[derive(Debug, Default)]
struct CacheState {
    entries: BTreeMap<String, Vec<u8>>,
    fail_store: bool,
    purge_calls: usize,
}

#[derive(Debug)]
struct MemoryCache {
    state: Arc<Mutex<CacheState>>,
}

impl RemoteCacheStore for MemoryCache {
    fn load(&mut self, cache_key: &str, _now_ms: i64) -> Result<Option<CachedImage>, AppError> {
        Ok(self
            .state
            .lock()
            .unwrap()
            .entries
            .get(cache_key)
            .cloned()
            .map(|bytes| CachedImage { bytes }))
    }

    fn store(&mut self, put: CachePut<'_>) -> Result<(), AppError> {
        let mut state = self.state.lock().unwrap();
        if state.fail_store {
            return Err(AppError::new(ErrorCode::IoWriteFailed));
        }
        state
            .entries
            .insert(put.cache_key.to_owned(), put.bytes.to_vec());
        Ok(())
    }

    fn remove(&mut self, cache_key: &str) -> Result<bool, AppError> {
        Ok(self
            .state
            .lock()
            .unwrap()
            .entries
            .remove(cache_key)
            .is_some())
    }

    fn purge(&mut self) -> Result<u64, AppError> {
        let mut state = self.state.lock().unwrap();
        state.purge_calls += 1;
        let removed = state.entries.len() as u64;
        state.entries.clear();
        Ok(removed)
    }
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

struct Harness {
    service: RemoteService,
    clock: ManualRemoteClock,
    resolver_state: Arc<Mutex<ResolverState>>,
    transport_state: Arc<Mutex<TransportState>>,
    cache_state: Arc<Mutex<CacheState>>,
}

impl Harness {
    fn push_http(&self, outcome: RemoteHttpOutcome) {
        self.transport_state
            .lock()
            .unwrap()
            .outcomes
            .push_back(Ok(outcome));
    }

    fn push_fetch_error(&self, error: AppError) {
        self.transport_state
            .lock()
            .unwrap()
            .outcomes
            .push_back(Err(error));
    }

    fn transport_calls(&self) -> usize {
        self.transport_state.lock().unwrap().calls.len()
    }

    fn resolver_calls(&self) -> usize {
        self.resolver_state.lock().unwrap().calls.len()
    }

    fn cached(&self, key: &str) -> Option<Vec<u8>> {
        self.cache_state.lock().unwrap().entries.get(key).cloned()
    }
}

fn build_harness(
    config: RemoteConfig,
    addresses: Vec<IpAddr>,
    clock: ManualRemoteClock,
    cache_state: Arc<Mutex<CacheState>>,
) -> Harness {
    let resolver_state = Arc::new(Mutex::new(ResolverState {
        fallback: addresses,
        ..ResolverState::default()
    }));
    let transport_state = Arc::new(Mutex::new(TransportState::default()));
    let cache = MemoryCache {
        state: cache_state.clone(),
    };
    let service = RemoteService::new(
        config,
        Box::new(clock.clone()),
        Box::new(ScriptResolver {
            state: resolver_state.clone(),
        }),
        Box::new(MockTransport {
            state: transport_state.clone(),
        }),
        Box::new(cache),
    );
    Harness {
        service,
        clock,
        resolver_state,
        transport_state,
        cache_state,
    }
}

fn harness_with(config: RemoteConfig, addresses: Vec<IpAddr>) -> Harness {
    build_harness(
        config,
        addresses,
        ManualRemoteClock::new(1_000),
        Arc::new(Mutex::new(CacheState::default())),
    )
}

fn public_v4() -> IpAddr {
    IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))
}

fn allowed_example() -> Vec<String> {
    vec!["https://example.com".to_owned()]
}

fn body(mime: &str, bytes: &[u8]) -> RemoteHttpOutcome {
    RemoteHttpOutcome::Response {
        status: 200,
        mime: mime.to_owned(),
        body: bytes.to_vec(),
    }
}

fn redirect(location: &str) -> RemoteHttpOutcome {
    RemoteHttpOutcome::Redirect {
        status: 302,
        location: location.to_owned(),
    }
}

fn fetch_example(harness: &mut Harness, url: &str) -> Result<RemoteFetch, AppError> {
    harness.service.fetch("d-1", url, &allowed_example())
}

// ---------------------------------------------------------------------------
// Protocol and allow-list
// ---------------------------------------------------------------------------

#[test]
fn only_https_urls_pass_the_protocol_check() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    for url in [
        "http://example.com/a.png",
        "data:image/png;base64,AAAA",
        "file:///tmp/a.png",
        "ftp://example.com/a.png",
    ] {
        let error = fetch_example(&mut harness, url).unwrap_err();
        assert_eq!(error.code(), ErrorCode::RemoteProtocol, "url {url}");
    }
    assert_eq!(harness.transport_calls(), 0);
}

#[test]
fn session_allow_list_is_exact_and_required() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);

    // No allowance at all: blocked before any resolution or transport call.
    let error = harness
        .service
        .fetch("d-1", "https://example.com/a.png", &[])
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteBlocked);
    assert_eq!(harness.resolver_calls(), 0);
    assert_eq!(harness.transport_calls(), 0);

    // Different origin.
    let error = harness
        .service
        .fetch(
            "d-1",
            "https://cdn.example.org/a.png",
            &["https://example.com".to_owned()],
        )
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteBlocked);

    // Same host, different port: still a different origin.
    let error = harness
        .service
        .fetch(
            "d-1",
            "https://example.com:8443/a.png",
            &["https://example.com".to_owned()],
        )
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteBlocked);

    // Exact origin with port is allowed.
    let result = harness
        .service
        .fetch(
            "d-1",
            "https://example.com:8443/a.png",
            &["https://Example.com:8443/".to_owned()],
        )
        .unwrap();
    assert!(!result.from_cache);
    assert_eq!(harness.transport_calls(), 1);
}

#[test]
fn origin_normalization_canonicalizes_default_port_and_case() {
    assert_eq!(
        normalize_origin("https://Example.com:443").unwrap(),
        "https://example.com"
    );
    assert_eq!(
        normalize_origin("https://example.com").unwrap(),
        "https://example.com"
    );
    assert_eq!(
        normalize_origin("https://example.com:8443/").unwrap(),
        "https://example.com:8443"
    );
    assert!(normalize_origin("http://example.com").is_err());
    assert!(normalize_origin("https://example.com/path").is_err());
    assert!(normalize_origin("https://example.com?a=b").is_err());
    assert!(normalize_origin("not a url").is_err());

    let allowed = vec![
        "https://Example.com:443".to_owned(),
        "not a valid origin".to_owned(),
    ];
    assert!(origin_allowed("https://example.com", &allowed));
    assert!(!origin_allowed("https://example.com:8443", &allowed));
    assert!(!origin_allowed("https://example.com", &[]));
}

// ---------------------------------------------------------------------------
// Resolved addresses
// ---------------------------------------------------------------------------

#[test]
fn blocked_address_classes_are_refused() {
    let blocked = [
        "10.0.0.5",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.1.1",
        "127.0.0.1",
        "169.254.1.1",
        "0.0.0.0",
        "224.0.0.1",
        "fd12:3456:789a::1",
        "fe80::1",
        "::1",
        "::",
        "ff02::1",
        "::ffff:192.168.0.1",
    ];
    for address in blocked {
        let parsed: IpAddr = address.parse().unwrap();
        assert!(is_blocked_address(parsed), "{address} must be blocked");
        let mut harness = harness_with(RemoteConfig::default(), vec![parsed]);
        let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
        assert_eq!(error.code(), ErrorCode::RemoteBlocked, "{address}");
        assert_eq!(harness.transport_calls(), 0, "{address}");
    }
}

#[test]
fn public_addresses_are_allowed() {
    let public = [
        "93.184.216.34",
        "172.32.0.1",
        "2606:4700::1111",
        "2001:db8::1",
        "::ffff:93.184.216.34",
    ];
    for address in public {
        let parsed: IpAddr = address.parse().unwrap();
        assert!(!is_blocked_address(parsed), "{address} must stay allowed");
        let mut harness = harness_with(RemoteConfig::default(), vec![parsed]);
        let result = fetch_example(&mut harness, "https://example.com/a.png").unwrap();
        assert!(!result.from_cache);
        assert_eq!(harness.transport_calls(), 1, "{address}");
    }
}

#[test]
fn every_resolved_address_is_checked_before_connecting() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness
        .resolver_state
        .lock()
        .unwrap()
        .responses
        .push_back(vec![public_v4(), "10.0.0.1".parse().unwrap()]);

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteBlocked);
    assert_eq!(harness.resolver_calls(), 1);
    assert_eq!(harness.transport_calls(), 0);
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

#[test]
fn literal_ip_urls_are_checked_without_dns() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    let error = harness
        .service
        .fetch(
            "d-1",
            "https://127.0.0.1/a.png",
            &["https://127.0.0.1".to_owned()],
        )
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteBlocked);
    assert_eq!(harness.resolver_calls(), 0, "no DNS for an IP literal");
    assert_eq!(harness.transport_calls(), 0);
}

#[test]
fn three_redirect_hops_are_allowed_and_a_fourth_is_blocked() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    for hop in ["/r1", "/r2", "/r3"] {
        harness.push_http(redirect(hop));
    }
    harness.push_http(body("image/png", b"final"));

    let result = fetch_example(&mut harness, "https://example.com/a.png").unwrap();
    assert_eq!(result.final_url, "https://example.com/r3");
    assert_eq!(result.size_bytes, 5);
    assert_eq!(
        result.cache_key,
        cache_key_for("https://example.com/a.png"),
        "cache key stays the requested URL across redirects"
    );
    assert!(harness.cached(&result.cache_key).is_some());
    assert_eq!(harness.transport_calls(), 4);
    // Each hop is resolved (and address-checked) again, never cached.
    assert_eq!(harness.resolver_calls(), 4);

    let mut blocked = harness_with(RemoteConfig::default(), vec![public_v4()]);
    for hop in ["/r1", "/r2", "/r3", "/r4"] {
        blocked.push_http(redirect(hop));
    }
    let error = fetch_example(&mut blocked, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteRedirectBlocked);
    assert_eq!(blocked.transport_calls(), 4);
}

#[test]
fn redirect_to_unallowed_origin_is_blocked_with_the_new_origin() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness.push_http(redirect("https://other.example/x"));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteRedirectBlocked);
    assert_eq!(harness.transport_calls(), 1);
    let details = error.details().expect("details must carry the new origin");
    assert_eq!(
        details.get("newOrigin"),
        Some(&DetailValue::String("https://other.example".to_owned()))
    );
}

#[test]
fn redirect_to_http_is_blocked() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness.push_http(redirect("http://example.com/next"));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteRedirectBlocked);
    assert_eq!(harness.transport_calls(), 1);
}

#[test]
fn redirect_hop_addresses_are_revalidated() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness
        .resolver_state
        .lock()
        .unwrap()
        .responses
        .push_back(vec![public_v4()]);
    harness
        .resolver_state
        .lock()
        .unwrap()
        .responses
        .push_back(vec!["10.9.8.7".parse().unwrap()]);
    harness.push_http(redirect("/next"));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteRedirectBlocked);
    assert_eq!(harness.resolver_calls(), 2);
    assert_eq!(harness.transport_calls(), 1);
}

// ---------------------------------------------------------------------------
// Size / time caps and no retry
// ---------------------------------------------------------------------------

#[test]
fn oversized_responses_hit_the_size_cap() {
    let config = RemoteConfig {
        max_bytes: 8,
        ..RemoteConfig::default()
    };
    let mut harness = harness_with(config, vec![public_v4()]);
    harness.push_http(body("image/png", &[0u8; 9]));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteLimit);
    assert_eq!(harness.transport_calls(), 1);
    assert!(
        harness.cache_state.lock().unwrap().entries.is_empty(),
        "an over-cap response must not be cached"
    );
}

#[test]
fn transport_size_errors_are_propagated_without_retry() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness.push_fetch_error(AppError::new(ErrorCode::RemoteLimit));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteLimit);
    assert_eq!(harness.transport_calls(), 1, "no automatic retry");
}

#[test]
fn network_failures_propagate_without_retry() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness.push_fetch_error(AppError::new(ErrorCode::RemoteFailed));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteFailed);
    assert_eq!(harness.transport_calls(), 1, "no automatic retry");
}

#[test]
fn total_time_cap_covers_all_redirects() {
    let config = RemoteConfig {
        total_timeout: Duration::from_millis(10),
        connect_timeout: Duration::from_millis(10),
        ..RemoteConfig::default()
    };
    let mut harness = harness_with(config, vec![public_v4()]);
    {
        let mut state = harness.transport_state.lock().unwrap();
        state.clock = Some(harness.clock.clone());
        state.advance_per_call = Some(Duration::from_millis(20));
    }
    harness.push_http(redirect("/next"));

    let error = fetch_example(&mut harness, "https://example.com/a.png").unwrap_err();
    assert_eq!(error.code(), ErrorCode::RemoteLimit);
    assert_eq!(harness.transport_calls(), 1);
}

#[test]
fn default_caps_match_the_security_model() {
    let config = RemoteConfig::default();
    assert_eq!(config.max_bytes, 20 * 1024 * 1024);
    assert_eq!(config.connect_timeout, Duration::from_secs(5));
    assert_eq!(config.total_timeout, Duration::from_secs(15));
    assert_eq!(config.max_redirects, 3);
    assert_eq!(config.cache_max_bytes, 256 * 1024 * 1024);
}

// ---------------------------------------------------------------------------
// Cache lifecycle
// ---------------------------------------------------------------------------

#[test]
fn cache_key_is_a_url_hash_with_the_contract_prefix() {
    let key = cache_key_for("https://example.com/x.png");
    assert!(key.starts_with("c-"));
    assert_eq!(key.len(), 18);
    assert!(key[2..].chars().all(|c| c.is_ascii_hexdigit()));
    assert_eq!(key, cache_key_for("https://example.com/x.png"));
    assert_ne!(key, cache_key_for("https://example.com/y.png"));
}

#[test]
fn successful_fetches_cache_and_reuse_until_revoke() {
    let url = "https://example.com/img.png";
    let key = cache_key_for(url);
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);

    harness.push_http(body("image/png", b"bytes-one"));
    let first = fetch_example(&mut harness, url).unwrap();
    assert!(!first.from_cache);
    assert!(first.memory_bytes.is_none());
    assert_eq!(first.mime, "image/png");
    assert_eq!(first.size_bytes, 9);
    assert_eq!(
        harness.cached(&key).as_deref(),
        Some(b"bytes-one".as_slice())
    );

    let second = fetch_example(&mut harness, url).unwrap();
    assert!(second.from_cache);
    assert_eq!(second.size_bytes, 9);
    assert_eq!(harness.transport_calls(), 1, "cache hit skips the network");

    let report = harness.service.revoke_session("d-1");
    assert_eq!(report.removed_cache_entries, 1);
    assert_eq!(report.failed_removals, 0);
    assert!(harness.cached(&key).is_none());

    let third = fetch_example(&mut harness, url).unwrap();
    assert!(!third.from_cache, "no reuse after revoke");
    assert_eq!(harness.transport_calls(), 2);
}

#[test]
fn revoke_only_deletes_that_document_sessions_entries() {
    let url_a = "https://example.com/a.png";
    let url_b = "https://example.com/b.png";
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness
        .service
        .fetch("d-1", url_a, &allowed_example())
        .unwrap();
    harness
        .service
        .fetch("d-2", url_b, &allowed_example())
        .unwrap();

    let report = harness.service.revoke_session("d-1");
    assert_eq!(report.removed_cache_entries, 1);
    assert!(harness.cached(&cache_key_for(url_a)).is_none());
    assert!(harness.cached(&cache_key_for(url_b)).is_some());

    // Revoking an unknown document is a no-op.
    let report = harness.service.revoke_session("d-unknown");
    assert_eq!(report.removed_cache_entries, 0);
    assert!(harness.cached(&cache_key_for(url_b)).is_some());
}

#[test]
fn cache_entries_are_never_reused_across_process_sessions() {
    let url = "https://example.com/img.png";
    let key = cache_key_for(url);
    let first_session = harness_with(RemoteConfig::default(), vec![public_v4()]);
    first_session
        .cache_state
        .lock()
        .unwrap()
        .entries
        .insert(key.clone(), b"stale-from-a-previous-session".to_vec());

    // A fresh process session shares the same on-disk cache but not the
    // in-process availability set.
    let mut second_session = build_harness(
        RemoteConfig::default(),
        vec![public_v4()],
        first_session.clock.clone(),
        first_session.cache_state.clone(),
    );
    second_session.push_http(body("image/png", b"fresh"));
    let result = second_session
        .service
        .fetch("d-2", url, &allowed_example())
        .unwrap();
    assert!(!result.from_cache);
    assert_eq!(second_session.transport_calls(), 1);
    assert_eq!(
        second_session.cached(&key).as_deref(),
        Some(b"fresh".as_slice())
    );
}

#[test]
fn purge_removes_every_cached_entry() {
    let url_a = "https://example.com/a.png";
    let url_b = "https://example.com/b.png";
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness
        .service
        .fetch("d-1", url_a, &allowed_example())
        .unwrap();
    harness
        .service
        .fetch("d-1", url_b, &allowed_example())
        .unwrap();

    let removed = harness.service.purge_cross_session_cache().unwrap();
    assert_eq!(removed, 2);
    assert!(harness.cache_state.lock().unwrap().entries.is_empty());
    assert_eq!(harness.cache_state.lock().unwrap().purge_calls, 1);

    // After a purge the same URL is fetched again, never served stale.
    let result = fetch_example(&mut harness, url_a).unwrap();
    assert!(!result.from_cache);
    assert_eq!(harness.transport_calls(), 3);
}

#[test]
fn cache_store_failure_still_returns_the_bytes_for_memory_serving() {
    let mut harness = harness_with(RemoteConfig::default(), vec![public_v4()]);
    harness.cache_state.lock().unwrap().fail_store = true;
    harness.push_http(body("image/png", b"png-bytes"));

    let result = fetch_example(&mut harness, "https://example.com/a.png").unwrap();
    assert!(!result.from_cache);
    assert_eq!(
        result.memory_bytes.as_deref(),
        Some(b"png-bytes".as_slice())
    );
    assert!(harness.cache_state.lock().unwrap().entries.is_empty());

    // A later call tries again (cache is rebuildable; no false cache hit).
    let again = fetch_example(&mut harness, "https://example.com/a.png").unwrap();
    assert!(!again.from_cache);
    assert_eq!(harness.transport_calls(), 2);
}

#[test]
fn reqwest_transport_constructs_without_network_access() {
    assert!(ReqwestTransport::new().is_ok());
}
