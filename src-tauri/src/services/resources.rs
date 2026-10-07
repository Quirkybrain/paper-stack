//! Remote resource policy and controlled fetch (security-model §4; contracts
//! §2.1 command 30, §4, §5; R26; models §8).
//!
//! The policy is HTTPS-only, session allow-listed per document, resolve-all
//! blocked-address checked, redirect-capped at three hops with a full
//! re-validation per hop, and capped at 20MiB / 5s connect / 15s total with
//! no automatic retry, no cookies and no referer (fixed UA
//! `PaperStack/0.1.0`). Only successful responses are written to the app
//! cache; a cache entry is never served across process sessions and is
//! deleted on session revoke.
//!
//! All outside effects go through injectable seams so the policy is testable
//! without a network: [`RemoteResolver`], [`RemoteTransport`] and
//! [`RemoteCacheStore`]; production implementations are [`SystemResolver`],
//! [`ReqwestTransport`] and [`StorageCacheStore`]. Time flows through
//! [`RemoteClock`] so size/time caps are testable without sleeping.

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt;
use std::fs;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use url::Url;

use crate::error::{AppError, ErrorCode};
use crate::models::{DetailValue, ErrorDetails};
use crate::services::files::sha256_hex;
use crate::services::storage::{resolve_cache_path, CacheEntry, Storage};

/// Single-response size cap (security-model §4; frozen initial value).
pub const REMOTE_MAX_BYTES: u64 = 20 * 1024 * 1024;
/// Connect timeout cap (security-model §4).
pub const REMOTE_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
/// Total fetch timeout cap, redirects included (security-model §4).
pub const REMOTE_TOTAL_TIMEOUT: Duration = Duration::from_secs(15);
/// Redirect cap: at most three hops (security-model §4).
pub const REMOTE_MAX_REDIRECTS: u32 = 3;
/// Fixed user agent (security-model §4: no cookies, no referer, fixed UA).
pub const REMOTE_USER_AGENT: &str = "PaperStack/0.1.0";
/// Remote image cache budget (`FrozenLimits.cacheMaxBytes`, SRS §6.1).
pub const CACHE_MAX_BYTES: u64 = 256 * 1024 * 1024;

const DEFAULT_MIME: &str = "application/octet-stream";

// ---------------------------------------------------------------------------
// Clock seam
// ---------------------------------------------------------------------------

/// Clock seam for the total-time cap.
pub trait RemoteClock: Send + Sync + fmt::Debug {
    fn now_ms(&self) -> i64;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemRemoteClock;

impl RemoteClock for SystemRemoteClock {
    fn now_ms(&self) -> i64 {
        match SystemTime::now().duration_since(UNIX_EPOCH) {
            Ok(duration) => i64::try_from(duration.as_millis()).unwrap_or(i64::MAX),
            Err(_) => 0,
        }
    }
}

/// Manually advanced clock for deterministic tests; clones share one instant.
#[derive(Debug, Default, Clone)]
pub struct ManualRemoteClock {
    now_ms: Arc<AtomicI64>,
}

impl ManualRemoteClock {
    pub fn new(start_ms: i64) -> Self {
        Self {
            now_ms: Arc::new(AtomicI64::new(start_ms)),
        }
    }

    pub fn set(&self, now_ms: i64) {
        self.now_ms.store(now_ms, Ordering::SeqCst);
    }

    pub fn advance(&self, delta: Duration) {
        let delta_ms = i64::try_from(delta.as_millis()).unwrap_or(i64::MAX);
        self.now_ms.fetch_add(delta_ms, Ordering::SeqCst);
    }
}

impl RemoteClock for ManualRemoteClock {
    fn now_ms(&self) -> i64 {
        self.now_ms.load(Ordering::SeqCst)
    }
}

// ---------------------------------------------------------------------------
// Policy configuration, protocols and addresses
// ---------------------------------------------------------------------------

/// Calibration/limit parameters of the remote policy; production uses
/// [`RemoteConfig::default`] (security-model §4 initial caps).
#[derive(Debug, Clone)]
pub struct RemoteConfig {
    pub max_bytes: u64,
    pub connect_timeout: Duration,
    pub total_timeout: Duration,
    pub max_redirects: u32,
    pub cache_max_bytes: u64,
}

impl Default for RemoteConfig {
    fn default() -> Self {
        Self {
            max_bytes: REMOTE_MAX_BYTES,
            connect_timeout: REMOTE_CONNECT_TIMEOUT,
            total_timeout: REMOTE_TOTAL_TIMEOUT,
            max_redirects: REMOTE_MAX_REDIRECTS,
            cache_max_bytes: CACHE_MAX_BYTES,
        }
    }
}

fn protocol_error(message: impl Into<String>) -> AppError {
    AppError::new(ErrorCode::RemoteProtocol).with_message(message)
}

/// Parses a remote reference: only `https` with a host passes
/// (security-model §4). `http` and every other scheme is
/// `PS_REMOTE_PROTOCOL`. Credential-bearing URLs are rejected before any
/// cache/allow-list/DNS/transport action (A-07; security-model §4
/// minimization: a document must never hand out credentials).
pub fn parse_remote_url(raw: &str) -> Result<Url, AppError> {
    let url = Url::parse(raw).map_err(|_| protocol_error("remote URL is not valid"))?;
    if url.scheme() != "https" {
        return Err(protocol_error("only https remote URLs are allowed"));
    }
    if url.host_str().is_none() {
        return Err(protocol_error("remote URL has no host"));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(protocol_error("remote URL must not contain credentials"));
    }
    Ok(url)
}

/// Normalizes a session allow-list entry to `https://host[:port]`; the
/// default port 443 is omitted. Entries with a path, query, fragment or
/// credentials are invalid and never match (security-model §4).
pub fn normalize_origin(raw: &str) -> Result<String, AppError> {
    let url = Url::parse(raw).map_err(|_| protocol_error("origin is not a valid URL"))?;
    if url.scheme() != "https" {
        return Err(protocol_error("origin must use https"));
    }
    if url.host_str().is_none() {
        return Err(protocol_error("origin has no host"));
    }
    if !matches!(url.path(), "" | "/") || url.query().is_some() || url.fragment().is_some() {
        return Err(protocol_error(
            "origin must not contain a path, query or fragment",
        ));
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(protocol_error("origin must not contain credentials"));
    }
    origin_from_url(&url)
}

/// Extracts the session allow-list origin of a full remote *reference*
/// (`check_resource_access` on a document image URL; security-model §4;
/// AT26/D-34-5).
///
/// Unlike [`normalize_origin`], which validates an allow-list *entry* and
/// therefore rejects any path, query or fragment, a document reference is a
/// full URL: only its origin takes part in the policy check, so the resource
/// path must never make the reference "unsupported". Credentials are rejected
/// outright (a resource reference must never carry them).
pub fn origin_for_remote_reference(raw: &str) -> Result<String, AppError> {
    let url = parse_remote_url(raw)?;
    if !url.username().is_empty() || url.password().is_some() {
        return Err(protocol_error(
            "remote reference must not contain credentials",
        ));
    }
    origin_from_url(&url)
}

/// `scheme://host[:port]` with the default port omitted. Used after scheme
/// validation for allow-list matching and for redirect diagnostics (where a
/// non-https scheme must be shown as-is).
fn origin_from_url(url: &Url) -> Result<String, AppError> {
    let scheme = url.scheme();
    let host = url
        .host_str()
        .ok_or_else(|| protocol_error("origin has no host"))?
        .to_ascii_lowercase();
    match (scheme, url.port()) {
        ("https", None | Some(443)) => Ok(format!("https://{host}")),
        (_, None) => Ok(format!("{scheme}://{host}")),
        (_, Some(port)) => Ok(format!("{scheme}://{host}:{port}")),
    }
}

/// Exact origin membership (security-model §4: no automatic widening).
pub fn origin_allowed(origin: &str, allowed: &[String]) -> bool {
    allowed
        .iter()
        .any(|raw| normalize_origin(raw).is_ok_and(|normalized| normalized == origin))
}

fn ipv4_is_blocked(address: Ipv4Addr) -> bool {
    let [a, b, _, _] = address.octets();
    a == 0                      // 0.0.0.0/8 (unspecified)
        || a == 10              // 10/8 private
        || a == 127             // 127/8 loopback
        || (a == 169 && b == 254) // 169.254/16 link-local
        || (a == 172 && (16..=31).contains(&b)) // 172.16/12 private
        || (a == 192 && b == 168) // 192.168/16 private
        || (a & 0xf0) == 224 // 224/4 multicast (unroutable as a destination)
}

fn ipv6_is_blocked(address: Ipv6Addr) -> bool {
    if let Some(mapped) = address.to_ipv4_mapped() {
        return ipv4_is_blocked(mapped);
    }
    let segments = address.segments();
    address.is_unspecified()               // ::/128
        || address.is_loopback()           // ::1/128
        || (segments[0] & 0xffc0) == 0xfe80 // fe80::/10 link-local
        || (segments[0] & 0xfe00) == 0xfc00 // fc00::/7 ULA
        || (segments[0] & 0xff00) == 0xff00 // ff00::/8 multicast
}

/// True when a resolved address must be refused before any connection
/// (security-model §4: private / loopback / link-local / ULA / multicast /
/// unspecified, including IPv4-mapped private addresses).
pub fn is_blocked_address(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => ipv4_is_blocked(address),
        IpAddr::V6(address) => ipv6_is_blocked(address),
    }
}

fn parse_ip_literal(host: &str) -> Option<IpAddr> {
    host.trim_start_matches('[')
        .trim_end_matches(']')
        .parse::<IpAddr>()
        .ok()
}

fn redirect_blocked(url: &Url, message: &str) -> AppError {
    let mut error =
        AppError::new(ErrorCode::RemoteRedirectBlocked).with_message(message.to_owned());
    if let Ok(origin) = origin_from_url(url) {
        let mut details = ErrorDetails::new();
        details.insert("newOrigin".to_owned(), DetailValue::String(origin));
        error = error.with_details(details);
    }
    error
}

// ---------------------------------------------------------------------------
// Injectable resolver and transport
// ---------------------------------------------------------------------------

/// DNS resolver seam: returns every address of `host`; the policy checks all
/// of them before connecting (security-model §4).
pub trait RemoteResolver: Send + Sync + fmt::Debug {
    fn resolve(&self, host: &str, port: u16) -> Result<Vec<IpAddr>, AppError>;
}

/// Production resolver backed by the platform DNS.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemResolver;

impl RemoteResolver for SystemResolver {
    fn resolve(&self, host: &str, port: u16) -> Result<Vec<IpAddr>, AppError> {
        let addresses = (host, port)
            .to_socket_addrs()
            .map_err(|error| AppError::new(ErrorCode::RemoteFailed).with_source(error))?;
        let mut ips: Vec<IpAddr> = Vec::new();
        for address in addresses {
            if !ips.contains(&address.ip()) {
                ips.push(address.ip());
            }
        }
        Ok(ips)
    }
}

/// One single-hop GET. The transport must not follow redirects itself, must
/// connect only to `resolved`, must not resolve DNS again, and must not read
/// more than `max_bytes` of body.
#[derive(Debug, Clone)]
pub struct RemoteHttpRequest {
    pub url: String,
    pub resolved: Vec<SocketAddr>,
    pub connect_timeout: Duration,
    pub total_timeout: Duration,
    pub max_bytes: u64,
}

/// Outcome of one single-hop GET.
#[derive(Debug, Clone)]
pub enum RemoteHttpOutcome {
    /// 3xx with a `Location` header (not followed by the transport).
    Redirect { status: u16, location: String },
    /// Any other response, body already capped.
    Response {
        status: u16,
        mime: String,
        body: Vec<u8>,
    },
}

/// Transport seam (production: [`ReqwestTransport`]; tests: mock).
pub trait RemoteTransport: Send + Sync + fmt::Debug {
    fn fetch(&self, request: &RemoteHttpRequest) -> Result<RemoteHttpOutcome, AppError>;
}

/// Production transport: reqwest with rustls, no proxy, no cookies, no
/// referer, fixed UA, no redirect following and address pinning.
pub struct ReqwestTransport {
    runtime: tokio::runtime::Runtime,
}

impl fmt::Debug for ReqwestTransport {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.debug_struct("ReqwestTransport").finish()
    }
}

impl ReqwestTransport {
    pub fn new() -> Result<Self, AppError> {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| {
                AppError::new(ErrorCode::RemoteFailed)
                    .with_message("failed to create the fetch runtime")
                    .with_source(error)
            })?;
        Ok(Self { runtime })
    }
}

impl RemoteTransport for ReqwestTransport {
    fn fetch(&self, request: &RemoteHttpRequest) -> Result<RemoteHttpOutcome, AppError> {
        self.runtime.block_on(fetch_once(request))
    }
}

async fn fetch_once(request: &RemoteHttpRequest) -> Result<RemoteHttpOutcome, AppError> {
    let url = Url::parse(&request.url).map_err(|_| protocol_error("request URL is not valid"))?;
    let host = url
        .host_str()
        .ok_or_else(|| protocol_error("request URL has no host"))?
        .to_owned();
    let mut builder = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .referer(false)
        .user_agent(REMOTE_USER_AGENT)
        .connect_timeout(request.connect_timeout);
    if !request.resolved.is_empty() && parse_ip_literal(&host).is_none() {
        builder = builder.resolve_to_addrs(&host, &request.resolved);
    }
    let client = builder
        .build()
        .map_err(|error| AppError::new(ErrorCode::RemoteFailed).with_source(error))?;
    let mut response = client
        .get(url)
        .timeout(request.total_timeout)
        .send()
        .await
        .map_err(map_reqwest_error)?;
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        let location = response
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| {
                AppError::new(ErrorCode::RemoteFailed)
                    .with_message("redirect response without a Location header")
            })?
            .to_owned();
        return Ok(RemoteHttpOutcome::Redirect { status, location });
    }
    let mime = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| {
            value
                .split(';')
                .next()
                .unwrap_or_default()
                .trim()
                .to_ascii_lowercase()
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_MIME.to_owned());
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_reqwest_error)? {
        if body.len() as u64 + chunk.len() as u64 > request.max_bytes {
            return Err(AppError::new(ErrorCode::RemoteLimit)
                .with_message("remote response exceeded the size cap"));
        }
        body.extend_from_slice(&chunk);
    }
    Ok(RemoteHttpOutcome::Response { status, mime, body })
}

fn map_reqwest_error(error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        AppError::new(ErrorCode::RemoteLimit)
            .with_message("remote request timed out")
            .with_source(error)
    } else {
        AppError::new(ErrorCode::RemoteFailed).with_source(error)
    }
}

// ---------------------------------------------------------------------------
// Injectable cache
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct CachedImage {
    pub bytes: Vec<u8>,
}

/// One cache write (data-model §2 `cache_meta`, `remote-images/` files).
#[derive(Debug)]
pub struct CachePut<'a> {
    pub cache_key: &'a str,
    pub source_url_hash: &'a str,
    pub bytes: &'a [u8],
    pub now_ms: i64,
}

/// Cache seam: only allowed, successful responses are written; a revoke or a
/// process session end must delete the affected entries (R26; data-model §7).
pub trait RemoteCacheStore: Send + Sync + fmt::Debug {
    fn load(&mut self, cache_key: &str, now_ms: i64) -> Result<Option<CachedImage>, AppError>;
    fn store(&mut self, put: CachePut<'_>) -> Result<(), AppError>;
    fn remove(&mut self, cache_key: &str) -> Result<bool, AppError>;
    /// Removes every remote-image cache entry; returns the removed count.
    fn purge(&mut self) -> Result<u64, AppError>;
}

/// Production cache: `cache_meta` rows plus `remote-images/<key>` files under
/// the app cache directory.
#[derive(Debug)]
pub struct StorageCacheStore {
    storage: Storage,
    cache_dir: PathBuf,
    max_bytes: u64,
}

impl StorageCacheStore {
    pub fn new(storage: Storage, cache_dir: impl Into<PathBuf>, max_bytes: u64) -> Self {
        Self {
            storage,
            cache_dir: cache_dir.into(),
            max_bytes,
        }
    }

    fn rel_path(cache_key: &str) -> String {
        format!("remote-images/{cache_key}")
    }
}

impl RemoteCacheStore for StorageCacheStore {
    fn load(&mut self, cache_key: &str, now_ms: i64) -> Result<Option<CachedImage>, AppError> {
        let Some(entry) = self.storage.cache_entry(cache_key)? else {
            return Ok(None);
        };
        let Some(path) = resolve_cache_path(&self.cache_dir, &entry.rel_path) else {
            return Ok(None);
        };
        match fs::read(&path) {
            Ok(bytes) => {
                let _ = self.storage.touch_cache_entry(cache_key, now_ms);
                Ok(Some(CachedImage { bytes }))
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(AppError::from_io_read(error)),
        }
    }

    fn store(&mut self, put: CachePut<'_>) -> Result<(), AppError> {
        let rel_path = Self::rel_path(put.cache_key);
        let Some(path) = resolve_cache_path(&self.cache_dir, &rel_path) else {
            return Err(AppError::new(ErrorCode::Internal).with_message("invalid remote cache key"));
        };
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(AppError::from_io_write)?;
        }
        fs::write(&path, put.bytes).map_err(AppError::from_io_write)?;
        let entry = CacheEntry {
            cache_key: put.cache_key.to_owned(),
            rel_path,
            size_bytes: put.bytes.len() as u64,
            source_url_hash: Some(put.source_url_hash.to_owned()),
            created_at_ms: put.now_ms,
            last_access_at_ms: put.now_ms,
        };
        if let Err(error) = self.storage.upsert_cache_entry(&entry) {
            let _ = fs::remove_file(&path);
            return Err(error);
        }
        self.storage
            .enforce_cache_limit(&self.cache_dir, self.max_bytes)?;
        Ok(())
    }

    fn remove(&mut self, cache_key: &str) -> Result<bool, AppError> {
        self.storage.remove_cache_entry(cache_key, &self.cache_dir)
    }

    fn purge(&mut self) -> Result<u64, AppError> {
        let entries: Vec<CacheEntry> = self.storage.cache_entries()?;
        let mut removed = 0u64;
        for entry in entries {
            // Deletion failures keep the row for the next LRU pass or purge;
            // the cache is rebuildable (data-model §7).
            if let Ok(true) = self
                .storage
                .remove_cache_entry(&entry.cache_key, &self.cache_dir)
            {
                removed += 1;
            }
        }
        Ok(removed)
    }
}

// ---------------------------------------------------------------------------
// RemoteService
// ---------------------------------------------------------------------------

/// Successful controlled fetch. `memory_bytes` is set only when the bytes
/// could not be persisted to the app cache; the caller may then serve them
/// from memory instead of a cache asset URL.
#[derive(Debug)]
pub struct RemoteFetch {
    pub mime: String,
    pub size_bytes: u64,
    pub final_url: String,
    pub cache_key: String,
    pub from_cache: bool,
    pub memory_bytes: Option<Vec<u8>>,
}

/// Effect of revoking one document session's remote allowance (R26).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct RemoteRevokeReport {
    pub removed_cache_entries: u64,
    /// Entries whose file/metadata deletion failed; kept for a later retry.
    pub failed_removals: u64,
}

/// `"c-" + first16hex(sha256(url))` (data-model §2: URL hash cache key).
pub fn cache_key_for(url: &str) -> String {
    let mut encoded = sha256_hex(url.as_bytes());
    encoded.truncate(16);
    format!("c-{encoded}")
}

/// Controlled remote fetch service (security-model §4; contracts §2.1
/// command 30).
#[derive(Debug)]
pub struct RemoteService {
    config: RemoteConfig,
    clock: Box<dyn RemoteClock>,
    resolver: Box<dyn RemoteResolver>,
    transport: Box<dyn RemoteTransport>,
    cache: Box<dyn RemoteCacheStore>,
    /// Cache keys written during this process session. Entries left on disk
    /// by a previous session are never served (no cross-session reuse).
    available: BTreeSet<String>,
    /// Mime learned when the entry was written; cache metadata has no mime
    /// column, and cross-session entries are not reusable anyway.
    mime_by_key: HashMap<String, String>,
    /// Cache keys written for each document session (revoke cleanup).
    doc_keys: BTreeMap<String, BTreeSet<String>>,
}

impl RemoteService {
    pub fn new(
        config: RemoteConfig,
        clock: Box<dyn RemoteClock>,
        resolver: Box<dyn RemoteResolver>,
        transport: Box<dyn RemoteTransport>,
        cache: Box<dyn RemoteCacheStore>,
    ) -> Self {
        Self {
            config,
            clock,
            resolver,
            transport,
            cache,
            available: BTreeSet::new(),
            mime_by_key: HashMap::new(),
            doc_keys: BTreeMap::new(),
        }
    }

    /// Production constructor: platform DNS + reqwest transport + SQLite
    /// cache. `cache_dir` is the app cache root (`remote-images/` lives
    /// inside it, data-model §1).
    pub fn with_reqwest(
        config: RemoteConfig,
        storage: Storage,
        cache_dir: impl Into<PathBuf>,
    ) -> Result<Self, AppError> {
        let cache_max_bytes = config.cache_max_bytes;
        let cache = StorageCacheStore::new(storage, cache_dir, cache_max_bytes);
        let transport = ReqwestTransport::new()?;
        Ok(Self::new(
            config,
            Box::new(SystemRemoteClock),
            Box::new(SystemResolver),
            Box::new(transport),
            Box::new(cache),
        ))
    }

    pub fn config(&self) -> &RemoteConfig {
        &self.config
    }

    /// Session-allowed controlled fetch (contracts §2.1 command 30).
    ///
    /// Order of enforcement: HTTPS parse → origin ∈ session allow-list →
    /// session-local cache (never cross-session) → per-hop resolve-all and
    /// blocked-address check → redirect loop with full re-validation →
    /// status/size caps → cache write. Nothing is fetched before the
    /// allow-list and address checks pass.
    pub fn fetch(
        &mut self,
        doc_id: &str,
        url: &str,
        allowed_origins: &[String],
    ) -> Result<RemoteFetch, AppError> {
        let parsed = parse_remote_url(url)?;
        let origin = origin_from_url(&parsed)?;
        if !origin_allowed(&origin, allowed_origins) {
            return Err(AppError::new(ErrorCode::RemoteBlocked)
                .with_message(format!("origin not allowed for this session: {origin}")));
        }

        let cache_key = cache_key_for(url);
        let now = self.clock.now_ms();
        if self.available.contains(&cache_key) {
            match self.cache.load(&cache_key, now) {
                Ok(Some(cached)) => {
                    let mime = self
                        .mime_by_key
                        .get(&cache_key)
                        .cloned()
                        .unwrap_or_else(|| DEFAULT_MIME.to_owned());
                    return Ok(RemoteFetch {
                        mime,
                        size_bytes: cached.bytes.len() as u64,
                        final_url: url.to_owned(),
                        cache_key,
                        from_cache: true,
                        memory_bytes: None,
                    });
                }
                Ok(None) => {
                    self.available.remove(&cache_key);
                    self.mime_by_key.remove(&cache_key);
                }
                // A broken cache entry must not block a permitted fetch.
                Err(_) => {}
            }
        }

        let started_ms = self.clock.now_ms();
        let mut current = parsed;
        let mut redirects: u32 = 0;
        loop {
            let remaining = self.remaining_total(started_ms)?;
            let resolved = self.resolve_and_validate(&current, redirects > 0)?;
            let outcome = self.transport.fetch(&RemoteHttpRequest {
                url: current.to_string(),
                resolved,
                connect_timeout: self.config.connect_timeout.min(remaining),
                total_timeout: remaining,
                max_bytes: self.config.max_bytes,
            })?;
            match outcome {
                RemoteHttpOutcome::Redirect { location, .. } => {
                    let Ok(next) = current.join(&location) else {
                        return Err(redirect_blocked(
                            &current,
                            "redirect location is not a valid URL",
                        ));
                    };
                    redirects += 1;
                    if redirects > self.config.max_redirects {
                        return Err(redirect_blocked(&next, "redirect limit exceeded"));
                    }
                    if next.scheme() != "https" {
                        return Err(redirect_blocked(&next, "redirect must stay on https"));
                    }
                    if !next.username().is_empty() || next.password().is_some() {
                        return Err(redirect_blocked(
                            &next,
                            "redirect target must not contain credentials",
                        ));
                    }
                    let next_origin = origin_from_url(&next).map_err(|_| {
                        redirect_blocked(&next, "redirect target has no valid origin")
                    })?;
                    if !origin_allowed(&next_origin, allowed_origins) {
                        return Err(redirect_blocked(
                            &next,
                            "redirect leaves the session-allowed origin set",
                        ));
                    }
                    current = next;
                }
                RemoteHttpOutcome::Response { status, mime, body } => {
                    if !(200..300).contains(&status) {
                        return Err(AppError::new(ErrorCode::RemoteFailed)
                            .with_message(format!("unexpected HTTP status {status}")));
                    }
                    if body.len() as u64 > self.config.max_bytes {
                        return Err(AppError::new(ErrorCode::RemoteLimit)
                            .with_message("remote response exceeded the size cap"));
                    }
                    let final_url = current.to_string();
                    let size_bytes = body.len() as u64;
                    let persisted = self.persist(doc_id, &cache_key, url, &mime, &body);
                    return Ok(RemoteFetch {
                        mime,
                        size_bytes,
                        final_url,
                        cache_key,
                        from_cache: false,
                        memory_bytes: (!persisted).then_some(body),
                    });
                }
            }
        }
    }

    /// Deletes the cache entries written for one document session (R26;
    /// INV-AZ-07). Never fails the revoke itself; failures are counted and
    /// left for a later purge/LRU pass.
    pub fn revoke_session(&mut self, doc_id: &str) -> RemoteRevokeReport {
        let keys = self.doc_keys.remove(doc_id).unwrap_or_default();
        let mut report = RemoteRevokeReport::default();
        for key in keys {
            self.available.remove(&key);
            self.mime_by_key.remove(&key);
            match self.cache.remove(&key) {
                Ok(true) => report.removed_cache_entries += 1,
                Ok(false) => {}
                Err(_) => report.failed_removals += 1,
            }
        }
        report
    }

    /// Absolute cache paths currently attributed to one document session
    /// (asset-scope cleanup on remote-session revoke, R26). Must be read
    /// before [`Self::revoke_session`], which drops the bookkeeping.
    pub fn session_cache_paths(&self, doc_id: &str, cache_dir: &Path) -> Vec<PathBuf> {
        self.doc_keys
            .get(doc_id)
            .map(|keys| {
                keys.iter()
                    .filter_map(|key| {
                        resolve_cache_path(cache_dir, &format!("remote-images/{key}"))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Removes every remote-image cache entry and clears the in-process
    /// availability set. Called at startup: session remote grants are purged
    /// then, so their cached bytes must never be reused across sessions
    /// (R26; models INV-AZ-09).
    pub fn purge_cross_session_cache(&mut self) -> Result<u64, AppError> {
        let removed = self.cache.purge()?;
        self.available.clear();
        self.mime_by_key.clear();
        self.doc_keys.clear();
        Ok(removed)
    }

    fn remaining_total(&self, started_ms: i64) -> Result<Duration, AppError> {
        let elapsed = u64::try_from(self.clock.now_ms().saturating_sub(started_ms).max(0))
            .unwrap_or(u64::MAX);
        let total = u64::try_from(self.config.total_timeout.as_millis()).unwrap_or(u64::MAX);
        if elapsed >= total {
            return Err(AppError::new(ErrorCode::RemoteLimit)
                .with_message("remote fetch exceeded the total time cap"));
        }
        Ok(Duration::from_millis(total - elapsed))
    }

    fn resolve_and_validate(
        &self,
        url: &Url,
        is_redirect: bool,
    ) -> Result<Vec<SocketAddr>, AppError> {
        let host = url
            .host_str()
            .ok_or_else(|| protocol_error("remote URL has no host"))?;
        let port = url
            .port_or_known_default()
            .ok_or_else(|| protocol_error("remote URL has no port"))?;
        let addresses: Vec<IpAddr> = match parse_ip_literal(host) {
            Some(ip) => vec![ip],
            None => {
                let resolved = self.resolver.resolve(host, port)?;
                if resolved.is_empty() {
                    return Err(AppError::new(ErrorCode::RemoteFailed)
                        .with_message("no addresses resolved"));
                }
                resolved
            }
        };
        for address in &addresses {
            if is_blocked_address(*address) {
                return Err(if is_redirect {
                    redirect_blocked(url, "redirect target resolves to a blocked address")
                } else {
                    AppError::new(ErrorCode::RemoteBlocked)
                        .with_message("remote host resolves to a blocked address")
                });
            }
        }
        Ok(addresses
            .into_iter()
            .map(|address| SocketAddr::new(address, port))
            .collect())
    }

    fn persist(
        &mut self,
        doc_id: &str,
        cache_key: &str,
        url: &str,
        mime: &str,
        bytes: &[u8],
    ) -> bool {
        let now = self.clock.now_ms();
        let source_url_hash = sha256_hex(url.as_bytes());
        let put = CachePut {
            cache_key,
            source_url_hash: &source_url_hash,
            bytes,
            now_ms: now,
        };
        match self.cache.store(put) {
            Ok(()) => {
                self.available.insert(cache_key.to_owned());
                self.mime_by_key
                    .insert(cache_key.to_owned(), mime.to_owned());
                self.doc_keys
                    .entry(doc_id.to_owned())
                    .or_default()
                    .insert(cache_key.to_owned());
                true
            }
            Err(_) => false,
        }
    }
}
