//! Document open/read services: open validation, decoding (UTF-8/BOM),
//! SHA-256 version identity, the §7.4 stable-read protocol, relink and
//! source-window/search access for large documents.
//!
//! Scope: contracts §2.1 commands 4–8 and 38, §3.1 models, §7.4 stability
//! text; security-model §8 read-only guarantee (only read APIs are exposed).
//! The IPC command surface is wired by a later work package; this module is
//! the trusted service core.
//!
//! Deviation note (recorded in the wp-10 evidence report): contracts §2.1
//! says >50MiB open does “64KiB probe + stat only”, while `DocIdentity`
//! (contracts §3.1) requires a 64-hex `contentHash` and `relink_document`
//! compares the last known hash. Open therefore performs one streaming
//! SHA-256 pass (no decoding, no buffering of the full text) for large files
//! so every contract field remains valid; the first 64KiB still drives the
//! encoding probe and nothing is cached in memory for them.

use std::collections::{BTreeMap, BTreeSet, HashMap, VecDeque};
use std::fmt;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};

use crate::error::{AppError, ErrorCode};
use crate::models::{
    DocIdentity, DocumentFormat, DocumentSnapshot, ReadPurpose, ReadSourceWindowRequest,
    RelinkResult, RelinkStatus, SearchSourceRequest, SourceInfo, SourceSearchMatch,
    SourceSearchResult, SourceWindow, TextEncoding, VersionInfo,
};
use crate::services::paths;

/// Files above this size are not fully decoded: source-window mode only
/// (hardLimitBytes, data-model §5; architecture §7).
pub const HARD_LIMIT_BYTES: u64 = 50 * 1024 * 1024;
/// Open validation probes at most this many leading bytes of a large file.
pub const PROBE_BYTES: usize = 64 * 1024;
/// Stability double-read window S1 (contracts §7.4; calibratable).
pub const STABILITY_WINDOW: Duration = Duration::from_millis(150);
/// Stability read attempt cap N (contracts §7.4).
pub const STABILITY_ATTEMPTS: u32 = 5;
/// Validation snapshot cache cap. Contracts do not freeze a Rust-side
/// retention; this mirrors the frontend `DocumentModel` LRU ≤2 (architecture
/// §6, plan T-22) so the two modules keep the same working set.
pub const SNAPSHOT_CACHE_CAPACITY: usize = 2;
/// Default `search_source` scan budget (calibratable initial value, NF06).
pub const SEARCH_BUDGET_BYTES: u64 = 256 * 1024 * 1024;
/// `maxLines` upper bound of `ReadSourceWindowRequest` (contracts §3.1).
pub const MAX_WINDOW_LINES: u64 = 2000;

const STREAM_CHUNK_BYTES: usize = 64 * 1024;
const READ_SCRATCH_BYTES: usize = 8 * 1024;
const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

// ---------------------------------------------------------------------------
// Time and disk primitives
// ---------------------------------------------------------------------------

/// Injectable clock/sleep seam so the stability protocol is testable without
/// real-time waits (`SystemTimer` is the production implementation).
pub trait StabilityTimer: Send + Sync + fmt::Debug {
    /// Epoch milliseconds UTC (contracts §1.1).
    fn now_ms(&self) -> i64;
    /// Waits S1 between the two reads of one stability attempt.
    fn wait_stability_window(&self, window: Duration);
}

/// Production timer backed by `std::time`.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemTimer;

impl StabilityTimer for SystemTimer {
    fn now_ms(&self) -> i64 {
        system_time_to_ms(SystemTime::now())
    }

    fn wait_stability_window(&self, window: Duration) {
        std::thread::sleep(window);
    }
}

/// Configurable limits and calibration parameters (only for tests and future
/// calibrated builds; production uses [`FilesConfig::default`]).
#[derive(Debug, Clone)]
pub struct FilesConfig {
    pub stability_window: Duration,
    pub stability_attempts: u32,
    pub snapshot_cache_capacity: usize,
    pub read_limit_bytes: u64,
    pub probe_bytes: usize,
    pub search_budget_bytes: u64,
    pub stream_chunk_bytes: usize,
}

impl Default for FilesConfig {
    fn default() -> Self {
        Self {
            stability_window: STABILITY_WINDOW,
            stability_attempts: STABILITY_ATTEMPTS,
            snapshot_cache_capacity: SNAPSHOT_CACHE_CAPACITY,
            read_limit_bytes: HARD_LIMIT_BYTES,
            probe_bytes: PROBE_BYTES,
            search_budget_bytes: SEARCH_BUDGET_BYTES,
            stream_chunk_bytes: STREAM_CHUNK_BYTES,
        }
    }
}

/// One raw disk read: bytes plus the file's mtime at read time.
#[derive(Debug, Clone)]
struct DiskRead {
    bytes: Vec<u8>,
    modified_at_ms: i64,
}

impl AsRef<[u8]> for DiskRead {
    fn as_ref(&self) -> &[u8] {
        &self.bytes
    }
}

/// Stat identity used for cheap “did the file change” checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct DiskProbe {
    size_bytes: u64,
    modified_at_ms: i64,
}

fn system_time_to_ms(time: SystemTime) -> i64 {
    match time.duration_since(UNIX_EPOCH) {
        Ok(duration) => i64::try_from(duration.as_millis()).unwrap_or(i64::MAX),
        Err(_) => 0,
    }
}

fn probe_from_metadata(metadata: &fs::Metadata) -> DiskProbe {
    DiskProbe {
        size_bytes: metadata.len(),
        modified_at_ms: system_time_to_ms(metadata.modified().unwrap_or(UNIX_EPOCH)),
    }
}

fn read_disk_limited(path: &Path, limit_bytes: u64) -> Result<DiskRead, AppError> {
    let metadata = fs::metadata(path).map_err(AppError::from_io_read)?;
    if metadata.len() > limit_bytes {
        return Err(AppError::new(ErrorCode::LimitSize));
    }
    let mut file = File::open(path).map_err(AppError::from_io_read)?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.read_to_end(&mut bytes)
        .map_err(AppError::from_io_read)?;
    let modified_at_ms = file
        .metadata()
        .map(|meta| system_time_to_ms(meta.modified().unwrap_or(UNIX_EPOCH)))
        .unwrap_or(0);
    Ok(DiskRead {
        bytes,
        modified_at_ms,
    })
}

fn hash_file(path: &Path) -> Result<(String, DiskProbe), AppError> {
    let mut file = File::open(path).map_err(AppError::from_io_read)?;
    let mut hasher = Sha256::new();
    let mut scratch = [0u8; READ_SCRATCH_BYTES];
    loop {
        let read = file.read(&mut scratch).map_err(AppError::from_io_read)?;
        if read == 0 {
            break;
        }
        hasher.update(&scratch[..read]);
    }
    let metadata = file.metadata().map_err(AppError::from_io_read)?;
    Ok((
        hex::encode(hasher.finalize()),
        probe_from_metadata(&metadata),
    ))
}

/// Full lowercase SHA-256 hex of `bytes` (version identity, contracts §3.1).
pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

/// `docId = "d-" + first16hex(sha256(canonicalPath))` (data-model §3.1).
pub fn doc_id_for(canonical_path: &str) -> String {
    format!("d-{}", first16_sha256_hex(canonical_path.as_bytes()))
}

fn first16_sha256_hex(input: &[u8]) -> String {
    let mut encoded = sha256_hex(input);
    encoded.truncate(16);
    encoded
}

// ---------------------------------------------------------------------------
// §7.4 stability protocol
// ---------------------------------------------------------------------------

/// Core of the stable-read protocol (contracts §7.4): `read` twice with a
/// `wait` in between; only identical content hashes are stable; up to
/// `attempts` double-reads, then `PS_IO_CHANGED`.
///
/// Kept generic over the read source so the protocol itself is unit-testable
/// deterministically (no filesystem, no real sleeps).
pub fn stable_reading<T, F, W>(mut read: F, mut wait: W, attempts: u32) -> Result<T, AppError>
where
    T: AsRef<[u8]>,
    F: FnMut() -> Result<T, AppError>,
    W: FnMut(),
{
    if attempts == 0 {
        return Err(AppError::new(ErrorCode::Internal)
            .with_message("stable read requires at least one attempt"));
    }
    for _ in 0..attempts {
        let first = read()?;
        wait();
        let second = read()?;
        if sha256_hex(first.as_ref()) == sha256_hex(second.as_ref()) {
            return Ok(second);
        }
    }
    Err(AppError::new(ErrorCode::IoChanged))
}

// ---------------------------------------------------------------------------
// Encoding and line helpers
// ---------------------------------------------------------------------------

/// Decodes a fully buffered document: UTF-8 BOM is stripped from the returned
/// text, NUL bytes and invalid UTF-8 are rejected as `PS_ENC_UNSUPPORTED`
/// (contracts §2.1 command 4; T-08).
pub fn decode_document(bytes: &[u8]) -> Result<(TextEncoding, String), AppError> {
    let (encoding, body) = match bytes.strip_prefix(UTF8_BOM.as_slice()) {
        Some(body) => (TextEncoding::Utf8Bom, body),
        None => (TextEncoding::Utf8, bytes),
    };
    if body.contains(&0) {
        return Err(AppError::new(ErrorCode::EncodingUnsupported)
            .with_message("binary content (NUL byte) is not a markdown document"));
    }
    let text = std::str::from_utf8(body)
        .map_err(|_| {
            AppError::new(ErrorCode::EncodingUnsupported)
                .with_message("document is not valid UTF-8")
        })?
        .to_owned();
    Ok((encoding, text))
}

/// Validates the leading probe of a >50MiB file without decoding it: BOM
/// detection, binary NUL rejection and UTF-8 prefix validation (a truncated
/// final code point is allowed for a prefix probe).
pub fn validate_source_probe(probe: &[u8]) -> Result<TextEncoding, AppError> {
    let (encoding, body) = match probe.strip_prefix(UTF8_BOM.as_slice()) {
        Some(body) => (TextEncoding::Utf8Bom, body),
        None => (TextEncoding::Utf8, probe),
    };
    if body.contains(&0) {
        return Err(AppError::new(ErrorCode::EncodingUnsupported)
            .with_message("binary content (NUL byte) is not a markdown document"));
    }
    if let Err(error) = std::str::from_utf8(body) {
        if error.error_len().is_some() {
            return Err(AppError::new(ErrorCode::EncodingUnsupported)
                .with_message("document is not valid UTF-8"));
        }
    }
    Ok(encoding)
}

/// 1-based line count; `""` has one (empty) line. Lines split on `\n`; a
/// trailing newline opens a final empty line, CRLF stays content (`\r` is
/// preserved, never rewritten).
pub fn line_count(text: &str) -> u64 {
    text.bytes().filter(|byte| *byte == b'\n').count() as u64 + 1
}

/// Byte offset of every line start (decoded text, 1-based line `n` at
/// `offsets[n - 1]`).
pub fn line_offsets(text: &str) -> Vec<u64> {
    let mut offsets = vec![0u64];
    for (index, byte) in text.bytes().enumerate() {
        if byte == b'\n' {
            offsets.push(index as u64 + 1);
        }
    }
    offsets
}

fn line_for_offset(offsets: &[u64], byte: u64) -> u64 {
    offsets.partition_point(|offset| *offset <= byte) as u64
}

fn window_bounds(start_line: u64, max_lines: u64, total_lines: u64) -> (u64, u64) {
    let start = start_line.max(1).min(total_lines);
    let end = start
        .saturating_add(max_lines.saturating_sub(1))
        .min(total_lines);
    (start, end)
}

/// Exclusive end byte of a window whose last line index is `end` (1-based)
/// among `total` lines, slicing on line boundaries: when more lines follow,
/// the terminating `\n` is excluded and a preceding `\r` (CRLF) is excluded
/// with it; when the window reaches the last line the raw tail is kept (a
/// trailing newline opens a final empty line, so it stays content).
fn window_end_byte(text: &str, offsets: &[u64], end: u64, total: u64) -> u64 {
    if end < total {
        let newline = offsets[end as usize] - 1;
        if newline > 0 && text.as_bytes().get((newline - 1) as usize) == Some(&b'\r') {
            return newline - 1;
        }
        newline
    } else {
        text.len() as u64
    }
}

// ---------------------------------------------------------------------------
// Chunked text sources
// ---------------------------------------------------------------------------

/// Chunks of an in-memory text on char boundaries.
struct TextChunks<'a> {
    text: &'a str,
    position: usize,
    chunk_bytes: usize,
}

impl<'a> TextChunks<'a> {
    fn new(text: &'a str, chunk_bytes: usize) -> Self {
        Self {
            text,
            position: 0,
            chunk_bytes: chunk_bytes.max(4),
        }
    }
}

impl Iterator for TextChunks<'_> {
    type Item = Result<(u64, String), AppError>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.position >= self.text.len() {
            return None;
        }
        let mut end = (self.position + self.chunk_bytes).min(self.text.len());
        while end > self.position && !self.text.is_char_boundary(end) {
            end -= 1;
        }
        if end == self.position {
            end = (self.position + 4).min(self.text.len());
        }
        let start = self.position;
        self.position = end;
        Some(Ok((start as u64, self.text[start..end].to_owned())))
    }
}

/// Decoded UTF-8 chunks of a file, stripping a leading BOM and never
/// splitting a code point; hashes every raw byte it reads (including the
/// BOM) so a streaming scan can validate the version in the same pass.
struct DecodedFileChunks {
    file: File,
    chunk_bytes: usize,
    pending: Vec<u8>,
    decoded_start: u64,
    eof: bool,
    first: bool,
    bom_seen: bool,
    hasher: Sha256,
}

impl DecodedFileChunks {
    fn new(file: File, chunk_bytes: usize) -> Result<Self, AppError> {
        let mut chunks = Self {
            file,
            chunk_bytes: chunk_bytes.max(4),
            pending: Vec::new(),
            decoded_start: 0,
            eof: false,
            first: true,
            bom_seen: false,
            hasher: Sha256::new(),
        };
        chunks.fill()?;
        Ok(chunks)
    }

    fn fill(&mut self) -> Result<(), AppError> {
        let mut scratch = [0u8; READ_SCRATCH_BYTES];
        while !self.eof && self.pending.len() < self.chunk_bytes {
            let read = self
                .file
                .read(&mut scratch)
                .map_err(AppError::from_io_read)?;
            if read == 0 {
                self.eof = true;
                break;
            }
            self.hasher.update(&scratch[..read]);
            self.pending.extend_from_slice(&scratch[..read]);
        }
        Ok(())
    }

    fn hash_hex(&self) -> String {
        hex::encode(self.hasher.clone().finalize())
    }

    fn bom_seen(&self) -> bool {
        self.bom_seen
    }
}

impl Iterator for DecodedFileChunks {
    type Item = Result<(u64, String), AppError>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.pending.is_empty() && self.eof {
                return None;
            }
            if self.pending.is_empty() {
                if let Err(error) = self.fill() {
                    return Some(Err(error));
                }
                continue;
            }
            if self.first {
                if self.pending.len() >= UTF8_BOM.len() {
                    if self.pending.starts_with(&UTF8_BOM) {
                        self.pending.drain(..UTF8_BOM.len());
                        self.bom_seen = true;
                    }
                    self.first = false;
                } else if self.eof {
                    self.first = false;
                } else if let Err(error) = self.fill() {
                    return Some(Err(error));
                } else {
                    continue;
                }
            }
            let valid = match std::str::from_utf8(&self.pending) {
                Ok(text) => text.len(),
                Err(error) => {
                    if error.error_len().is_some() {
                        return Some(Err(AppError::new(ErrorCode::EncodingUnsupported)
                            .with_message("document is not valid UTF-8")));
                    }
                    error.valid_up_to()
                }
            };
            if valid == 0 {
                if self.eof {
                    return Some(Err(AppError::new(ErrorCode::EncodingUnsupported)
                        .with_message("document is not valid UTF-8")));
                }
                if let Err(error) = self.fill() {
                    return Some(Err(error));
                }
                continue;
            }
            let text = std::str::from_utf8(&self.pending[..valid])
                .map(str::to_owned)
                .unwrap_or_default();
            let decoded_start = self.decoded_start;
            self.pending.drain(..valid);
            self.decoded_start += valid as u64;
            return Some(Ok((decoded_start, text)));
        }
    }
}

// ---------------------------------------------------------------------------
// Streaming literal search (commands 38; contracts §2.1, §7)
// ---------------------------------------------------------------------------

/// One folded search segment: `folded` bytes plus, for every folded byte, the
/// enclosing original byte range `(abs_start, abs_end)`.
#[derive(Debug)]
struct FoldedSegment {
    folded: String,
    mapping: Vec<(u64, u64)>,
}

fn fold_segment(chunk: &str, abs_start: u64, case_sensitive: bool) -> FoldedSegment {
    let mut folded = String::with_capacity(chunk.len());
    let mut mapping = Vec::with_capacity(chunk.len());
    for (index, character) in chunk.char_indices() {
        let start = abs_start + index as u64;
        let end = start + character.len_utf8() as u64;
        if case_sensitive {
            folded.push(character);
            mapping.extend(std::iter::repeat_n((start, end), character.len_utf8()));
        } else {
            for lower in character.to_lowercase() {
                folded.push(lower);
                mapping.extend(std::iter::repeat_n((start, end), lower.len_utf8()));
            }
        }
    }
    FoldedSegment { folded, mapping }
}

fn fold_query(query: &str, case_sensitive: bool) -> String {
    if case_sensitive {
        query.to_owned()
    } else {
        query.chars().flat_map(char::to_lowercase).collect()
    }
}

#[derive(Debug)]
struct FoldedWindow {
    folded: String,
    mapping: Vec<(u64, u64)>,
    folded_base: u64,
}

impl FoldedWindow {
    fn from_segment(segment: FoldedSegment, folded_base: u64) -> Self {
        Self {
            folded: segment.folded,
            mapping: segment.mapping,
            folded_base,
        }
    }

    fn append(&mut self, segment: FoldedSegment) {
        self.folded.push_str(&segment.folded);
        self.mapping.extend(segment.mapping);
    }

    /// Keeps at least `keep` trailing bytes (never splitting a code point) so
    /// matches spanning a chunk boundary are still found on the next window.
    fn trim(self, keep: usize) -> Option<Self> {
        if keep == 0 {
            return None;
        }
        if self.folded.len() <= keep {
            return Some(self);
        }
        let mut start = self.folded.len().saturating_sub(keep);
        while start > 0 && !self.folded.is_char_boundary(start) {
            start -= 1;
        }
        if start == 0 {
            return Some(self);
        }
        Some(Self {
            folded: self.folded[start..].to_owned(),
            mapping: self.mapping[start..].to_vec(),
            folded_base: self.folded_base + start as u64,
        })
    }
}

struct ScanOutcome {
    matches: Vec<SourceSearchMatch>,
    scanned_bytes: u64,
    complete: bool,
    /// True when the chunk iterator was exhausted (so a streaming scan may
    /// trust its accumulated hash).
    to_end: bool,
}

struct SourceScanner<'a> {
    needle: String,
    case_sensitive: bool,
    max_results: u64,
    budget_bytes: u64,
    line_offsets: &'a [u64],
    matches: Vec<SourceSearchMatch>,
    scanned: u64,
}

impl<'a> SourceScanner<'a> {
    fn new(
        query: &str,
        case_sensitive: bool,
        max_results: u64,
        budget_bytes: u64,
        line_offsets: &'a [u64],
    ) -> Self {
        Self {
            needle: fold_query(query, case_sensitive),
            case_sensitive,
            max_results,
            budget_bytes,
            line_offsets,
            matches: Vec::new(),
            scanned: 0,
        }
    }

    fn run<I>(&mut self, chunks: I, total_bytes: u64) -> Result<ScanOutcome, AppError>
    where
        I: Iterator<Item = Result<(u64, String), AppError>>,
    {
        if self.needle.is_empty() {
            return Ok(ScanOutcome {
                matches: Vec::new(),
                scanned_bytes: 0,
                complete: true,
                // Nothing was consumed; a streaming caller must not trust a
                // partial hash for the version check.
                to_end: false,
            });
        }
        if self.max_results == 0 {
            return Ok(ScanOutcome {
                matches: Vec::new(),
                scanned_bytes: 0,
                complete: false,
                to_end: false,
            });
        }
        let keep = self.needle.len().saturating_sub(1);
        let mut carry: Option<FoldedWindow> = None;
        // Folded absolute position after the last reported match; matches are
        // reported leftmost, non-overlapping, exactly like a single-buffer
        // scan (`search_pos = match_end`).
        let mut scan_floor: Option<u64> = None;
        let mut stopped = false;
        for item in chunks {
            let (abs, chunk) = item?;
            let mut text = chunk;
            let mut budget_hit = false;
            if self.scanned + text.len() as u64 > self.budget_bytes {
                let room = self.budget_bytes.saturating_sub(self.scanned) as usize;
                let mut cut = room.min(text.len());
                while cut > 0 && !text.is_char_boundary(cut) {
                    cut -= 1;
                }
                text.truncate(cut);
                budget_hit = true;
            }
            if text.is_empty() {
                stopped = true;
                break;
            }
            let segment = fold_segment(&text, abs, self.case_sensitive);
            let window = match carry.take() {
                Some(mut previous) => {
                    previous.append(segment);
                    previous
                }
                None => FoldedWindow::from_segment(segment, 0),
            };
            let window_start = window.folded_base;
            let floor = scan_floor.unwrap_or(window_start).max(window_start);
            let mut search_position = 0usize;
            let mut cap_hit = false;
            while let Some(relative) = window.folded[search_position..].find(&self.needle) {
                let match_start = search_position + relative;
                let match_end = match_start + self.needle.len();
                let absolute_start = window.folded_base + match_start as u64;
                if absolute_start < floor {
                    search_position = match_start + 1;
                    continue;
                }
                let start_byte = window.mapping[match_start].0;
                let end_byte = window.mapping[match_end - 1].1;
                self.matches.push(SourceSearchMatch {
                    start_byte,
                    end_byte,
                    line_number: line_for_offset(self.line_offsets, start_byte),
                });
                scan_floor = Some(window.folded_base + match_end as u64);
                if self.matches.len() as u64 >= self.max_results {
                    self.scanned = self.scanned.max(end_byte);
                    cap_hit = true;
                    break;
                }
                search_position = match_end;
            }
            if cap_hit {
                stopped = true;
                break;
            }
            self.scanned += text.len() as u64;
            if budget_hit {
                stopped = true;
                break;
            }
            carry = window.trim(keep);
        }
        let to_end = !stopped && self.scanned >= total_bytes;
        Ok(ScanOutcome {
            matches: std::mem::take(&mut self.matches),
            scanned_bytes: self.scanned,
            complete: to_end,
            to_end,
        })
    }
}

// ---------------------------------------------------------------------------
// Registered documents and snapshot cache
// ---------------------------------------------------------------------------

/// Lazy line index and hash for a >50MiB (source-window only) document.
#[derive(Debug, Clone)]
struct LargeSource {
    content_hash: String,
    raw_size: u64,
    content_len: u64,
    modified_at_ms: i64,
    encoding: TextEncoding,
    line_offsets: Vec<u64>,
}

/// A document registered by `open_document`, carrying the last successfully
/// read version (data-model §3.1; contracts §3.1 `DocIdentity`).
#[derive(Debug, Clone)]
pub struct RegisteredDocument {
    doc_id: String,
    path: PathBuf,
    canonical_path: String,
    display_name: String,
    encoding: TextEncoding,
    version: VersionInfo,
    last_seen_at_ms: i64,
    full_read: bool,
    line_count: u64,
    large_source: Option<LargeSource>,
}

impl RegisteredDocument {
    pub fn doc_id(&self) -> &str {
        &self.doc_id
    }

    pub fn canonical_path(&self) -> &str {
        &self.canonical_path
    }

    pub fn display_name(&self) -> &str {
        &self.display_name
    }

    pub fn encoding(&self) -> TextEncoding {
        self.encoding
    }

    pub fn version(&self) -> &VersionInfo {
        &self.version
    }

    pub fn last_seen_at_ms(&self) -> i64 {
        self.last_seen_at_ms
    }

    /// `false` for >50MiB documents that use source-window mode only.
    pub fn is_full_read(&self) -> bool {
        self.full_read
    }

    pub fn line_count(&self) -> u64 {
        self.line_count
    }

    /// Contract identity of the last successful read (contracts §3.1).
    pub fn identity(&self) -> DocIdentity {
        DocIdentity {
            doc_id: self.doc_id.clone(),
            canonical_path: self.canonical_path.clone(),
            display_name: self.display_name.clone(),
            format: DocumentFormat::Markdown,
            encoding: self.encoding,
            content_hash: self.version.content_hash.clone(),
            size_bytes: self.version.size_bytes,
            last_seen_at_ms: self.last_seen_at_ms,
        }
    }
}

/// Result of `open_document`: identity plus the decoded snapshot for
/// full-read documents (≤50MiB), or source-window mode for larger files.
#[derive(Debug, Clone)]
pub struct OpenedDocument {
    pub doc_id: String,
    pub identity: DocIdentity,
    /// `true` when the canonical path was already registered (R05).
    pub duplicate: bool,
    /// `true` when the file exceeds the full-read limit (`PS_LIMIT_SIZE` for
    /// `read_document`; source windows remain available).
    pub source_only: bool,
    pub snapshot: Option<DocumentSnapshot>,
}

#[derive(Debug, Default)]
struct SnapshotCache {
    capacity: usize,
    order: VecDeque<String>,
    entries: HashMap<String, DocumentSnapshot>,
}

impl SnapshotCache {
    fn with_capacity(capacity: usize) -> Self {
        Self {
            capacity,
            order: VecDeque::new(),
            entries: HashMap::new(),
        }
    }

    fn get(&mut self, doc_id: &str) -> Option<&DocumentSnapshot> {
        if !self.entries.contains_key(doc_id) {
            return None;
        }
        self.order.retain(|id| id != doc_id);
        self.order.push_back(doc_id.to_owned());
        self.entries.get(doc_id)
    }

    fn insert(&mut self, snapshot: DocumentSnapshot) {
        let doc_id = snapshot.doc_id.clone();
        self.entries.insert(doc_id.clone(), snapshot);
        self.order.retain(|id| id != &doc_id);
        self.order.push_back(doc_id);
        while self.entries.len() > self.capacity {
            match self.order.pop_front() {
                Some(oldest) => {
                    self.entries.remove(&oldest);
                }
                None => break,
            }
        }
    }

    fn count(&self) -> usize {
        self.entries.len()
    }
}

// ---------------------------------------------------------------------------
// FilesService
// ---------------------------------------------------------------------------

/// Trusted document service: open validation/decoding, `read_document`
/// semantics (initial/restore/refresh/relink), and source info/window/search.
///
/// All file access is read-only: no method in this module writes to a source
/// file or directory (security-model §8).
#[derive(Debug)]
pub struct FilesService {
    config: FilesConfig,
    timer: Box<dyn StabilityTimer>,
    snapshots: SnapshotCache,
    documents: BTreeMap<String, RegisteredDocument>,
    paths_index: HashMap<String, String>,
    /// Canonical paths of every source document this session attempted to
    /// open, including decode/format-rejected ones that never registered.
    /// Diagnostics export must protect these source directories too
    /// (R04/R28; AT28/D-34-7).
    known_sources: BTreeSet<PathBuf>,
}

impl Default for FilesService {
    fn default() -> Self {
        Self::new()
    }
}

impl FilesService {
    pub fn new() -> Self {
        Self::with_timer(FilesConfig::default(), Box::new(SystemTimer))
    }

    pub fn with_config(config: FilesConfig) -> Self {
        Self::with_timer(config, Box::new(SystemTimer))
    }

    pub fn with_timer(config: FilesConfig, timer: Box<dyn StabilityTimer>) -> Self {
        let capacity = config.snapshot_cache_capacity;
        Self {
            config,
            timer,
            snapshots: SnapshotCache::with_capacity(capacity),
            documents: BTreeMap::new(),
            paths_index: HashMap::new(),
            known_sources: BTreeSet::new(),
        }
    }

    /// Registered document by `docId` (read accessor for the command layer).
    pub fn document(&self, doc_id: &str) -> Option<&RegisteredDocument> {
        self.documents.get(doc_id)
    }

    /// Registered documents in `docId` order (read accessor for the command
    /// layer: diagnostics bundle rows, protected export sources, relink).
    pub fn registered_documents(&self) -> impl Iterator<Item = &RegisteredDocument> {
        self.documents.values()
    }

    /// Known source locations of this session in canonical-path order:
    /// registered documents plus every readable `.md`/`.markdown` target that
    /// later failed validation (encoding/format), so error-state documents
    /// still protect their source directory from diagnostics export
    /// (AT28/D-34-7).
    pub fn known_source_paths(&self) -> impl Iterator<Item = &PathBuf> {
        self.known_sources.iter()
    }

    pub fn registered_count(&self) -> usize {
        self.documents.len()
    }

    pub fn cached_snapshot_count(&self) -> usize {
        self.snapshots.count()
    }

    /// Open validation + decoding (contracts §2.1 command 4; T-08). Validates
    /// extension, existence, readability, regular-file kind and encoding;
    /// caches the decoded snapshot for a following `read_document(initial)`.
    pub fn open_document(&mut self, raw_path: &str) -> Result<OpenedDocument, AppError> {
        let canonical = resolve_open_target(raw_path)?;
        // A readable markdown target is a known source location from here on,
        // even when decoding/validation rejects it later (AT28/D-34-7).
        self.known_sources.insert(canonical.clone());
        let canonical_path = canonical.to_string_lossy().into_owned();
        let doc_id = doc_id_for(&canonical_path);
        let duplicate = self.documents.contains_key(&doc_id);

        let metadata = fs::metadata(&canonical).map_err(AppError::from_io_read)?;
        let now = self.timer.now_ms();
        let modified_at_ms = system_time_to_ms(metadata.modified().unwrap_or(UNIX_EPOCH));
        let size_bytes = metadata.len();

        let (encoding, version, snapshot, source_only) =
            if size_bytes > self.config.read_limit_bytes {
                let mut file = File::open(&canonical).map_err(AppError::from_io_read)?;
                let probe = read_probe(&mut file, self.config.probe_bytes)?;
                let encoding = validate_source_probe(&probe)?;
                let content_hash = hash_reader(&mut file)?;
                let version = VersionInfo {
                    content_hash,
                    size_bytes,
                    modified_at_ms,
                    observed_at_ms: now,
                };
                (encoding, version, None, true)
            } else {
                let disk = read_disk_limited(&canonical, self.config.read_limit_bytes)?;
                let (encoding, text) = decode_document(&disk.bytes)?;
                let content_hash = sha256_hex(&disk.bytes);
                let version = VersionInfo {
                    content_hash,
                    size_bytes: disk.bytes.len() as u64,
                    modified_at_ms: disk.modified_at_ms,
                    observed_at_ms: now,
                };
                let line_count = line_count(&text);
                let identity = identity_from(
                    &doc_id,
                    &canonical_path,
                    &canonical,
                    encoding,
                    &version,
                    now,
                );
                let snapshot = DocumentSnapshot {
                    doc_id: doc_id.clone(),
                    identity,
                    version: version.clone(),
                    text,
                    line_count,
                };
                (encoding, version, Some(snapshot), false)
            };

        let line_count = snapshot.as_ref().map(|s| s.line_count).unwrap_or(0);
        let identity = match &snapshot {
            Some(snapshot) => snapshot.identity.clone(),
            None => identity_from(
                &doc_id,
                &canonical_path,
                &canonical,
                encoding,
                &version,
                now,
            ),
        };

        self.upsert_registration(
            doc_id.clone(),
            canonical,
            canonical_path,
            encoding,
            version,
            now,
            !source_only,
            line_count,
        );
        if let Some(snapshot) = &snapshot {
            self.snapshots.insert(snapshot.clone());
        }
        Ok(OpenedDocument {
            doc_id,
            identity,
            duplicate,
            source_only,
            snapshot,
        })
    }

    /// `read_document` semantics (contracts §2.1 command 5; T-09):
    /// `initial|restore` may hit the validation snapshot cache; `refresh` and
    /// post-relink reads run the §7.4 stable read. Any success carries a fresh
    /// `VersionInfo` whose `contentHash` is the SHA-256 of the read bytes.
    pub fn read_document(
        &mut self,
        doc_id: &str,
        purpose: ReadPurpose,
    ) -> Result<DocumentSnapshot, AppError> {
        let full_read = self
            .documents
            .get(doc_id)
            .map(|document| document.full_read)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        if !full_read {
            return Err(AppError::new(ErrorCode::LimitSize));
        }
        match purpose {
            ReadPurpose::Initial | ReadPurpose::Restore => match self.cached_snapshot(doc_id) {
                Some(snapshot) => Ok(snapshot),
                None => self.reload_registered_snapshot(doc_id),
            },
            ReadPurpose::Refresh | ReadPurpose::Relink => self.stable_refresh(doc_id),
        }
    }

    /// `relink_document` (contracts §2.1 command 6; R07): same bytes as the
    /// last known `contentHash` reassociate, different bytes become a new
    /// version of the same `docId`. The read runs the stable protocol.
    pub fn relink_document(
        &mut self,
        doc_id: &str,
        new_path: &str,
    ) -> Result<RelinkResult, AppError> {
        if !self.documents.contains_key(doc_id) {
            return Err(AppError::new(ErrorCode::IoNotFound));
        }
        let canonical = resolve_open_target(new_path)?;
        self.known_sources.insert(canonical.clone());
        let canonical_path = canonical.to_string_lossy().into_owned();
        if let Some(existing) = self.paths_index.get(&canonical_path) {
            if existing != doc_id {
                return Err(AppError::new(ErrorCode::Internal)
                    .with_message("relink target path already belongs to another document"));
            }
        }
        let metadata = fs::metadata(&canonical).map_err(AppError::from_io_read)?;
        if metadata.len() > self.config.read_limit_bytes {
            return Err(AppError::new(ErrorCode::LimitSize));
        }
        let window = self.config.stability_window;
        let attempts = self.config.stability_attempts;
        let limit = self.config.read_limit_bytes;
        let timer = self.timer.as_ref();
        let path = canonical.clone();
        let disk = stable_reading(
            || read_disk_limited(&path, limit),
            || timer.wait_stability_window(window),
            attempts,
        )?;
        let (encoding, text) = decode_document(&disk.bytes)?;
        let content_hash = sha256_hex(&disk.bytes);
        let previous_hash = self
            .documents
            .get(doc_id)
            .map(|document| document.version.content_hash.clone())
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        let status = if content_hash == previous_hash {
            RelinkStatus::Reassociated
        } else {
            RelinkStatus::NewVersion
        };
        let now = self.timer.now_ms();
        let version = VersionInfo {
            content_hash,
            size_bytes: disk.bytes.len() as u64,
            modified_at_ms: disk.modified_at_ms,
            observed_at_ms: now,
        };
        let line_count = line_count(&text);
        let display_name = display_name_for(&canonical);
        let identity = identity_from(doc_id, &canonical_path, &canonical, encoding, &version, now);
        let snapshot = DocumentSnapshot {
            doc_id: doc_id.to_owned(),
            identity,
            version: version.clone(),
            text,
            line_count,
        };

        let old_path = self
            .documents
            .get(doc_id)
            .map(|document| document.canonical_path.clone());
        if let Some(old_path) = old_path {
            if old_path != canonical_path {
                self.paths_index.remove(&old_path);
            }
        }
        self.paths_index
            .insert(canonical_path.clone(), doc_id.to_owned());
        if let Some(document) = self.documents.get_mut(doc_id) {
            document.path = canonical;
            document.canonical_path = canonical_path;
            document.display_name = display_name;
            document.encoding = encoding;
            document.version = version;
            document.last_seen_at_ms = now;
            document.full_read = true;
            document.line_count = line_count;
            document.large_source = None;
        }
        self.snapshots.insert(snapshot.clone());
        Ok(RelinkResult { status, snapshot })
    }

    /// `get_source_info` (contracts §2.1 command 7; R18/R29). Returns the
    /// registered (displayed) version without reading a new disk version for
    /// full-read documents; large documents build the lazy line index.
    pub fn get_source_info(&mut self, doc_id: &str) -> Result<SourceInfo, AppError> {
        let full_read = self
            .documents
            .get(doc_id)
            .map(|document| document.full_read)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        if !full_read {
            self.ensure_large_source(doc_id)?;
        }
        let document = self
            .documents
            .get(doc_id)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        Ok(SourceInfo {
            doc_id: doc_id.to_owned(),
            version: document.version.clone(),
            encoding: document.encoding,
            total_lines: document.line_count,
        })
    }

    /// `read_source_window` (contracts §2.1 command 8). Full-read documents
    /// serve from the displayed snapshot (reload on cache miss validates the
    /// hash); large documents stream the requested line range from disk.
    pub fn read_source_window(
        &mut self,
        request: &ReadSourceWindowRequest,
    ) -> Result<SourceWindow, AppError> {
        if request.start_line < 1 || request.max_lines < 1 || request.max_lines > MAX_WINDOW_LINES {
            return Err(AppError::new(ErrorCode::Internal)
                .with_message("source window requires startLine >= 1 and 1 <= maxLines <= 2000"));
        }
        let full_read = self
            .documents
            .get(&request.doc_id)
            .map(|document| document.full_read)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        if full_read {
            let snapshot = match self.cached_snapshot(&request.doc_id) {
                Some(snapshot) => snapshot,
                None => self.reload_registered_snapshot(&request.doc_id)?,
            };
            let offsets = line_offsets(&snapshot.text);
            let total = offsets.len() as u64;
            let (start, end) = window_bounds(request.start_line, request.max_lines, total);
            let start_byte = offsets[(start - 1) as usize];
            let end_byte = window_end_byte(&snapshot.text, &offsets, end, total);
            let text = snapshot.text[start_byte as usize..end_byte as usize].to_owned();
            Ok(SourceWindow {
                doc_id: request.doc_id.clone(),
                version: snapshot.version,
                start_line: start,
                end_line: end,
                text,
                eof: end == total,
            })
        } else {
            self.large_source_window(request)
        }
    }

    /// `search_source` (contracts §2.1 command 38; R17/R29). Literal,
    /// case-folded according to `caseSensitive`, streaming for large files,
    /// with an explicit incomplete result when the result or byte budget is
    /// exceeded. The version is validated before and after the scan.
    pub fn search_source(
        &mut self,
        request: &SearchSourceRequest,
    ) -> Result<SourceSearchResult, AppError> {
        let full_read = self
            .documents
            .get(&request.doc_id)
            .map(|document| document.full_read)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        if full_read {
            self.search_full_read(request)
        } else {
            self.search_large_source(request)
        }
    }

    // -- internals ---------------------------------------------------------

    fn cached_snapshot(&mut self, doc_id: &str) -> Option<DocumentSnapshot> {
        let current_hash = self.documents.get(doc_id)?.version.content_hash.clone();
        let cached = self.snapshots.get(doc_id)?;
        if cached.version.content_hash == current_hash {
            Some(cached.clone())
        } else {
            None
        }
    }

    fn identity_for(
        &self,
        doc_id: &str,
        encoding: TextEncoding,
        version: &VersionInfo,
        last_seen_at_ms: i64,
    ) -> Result<DocIdentity, AppError> {
        let document = self
            .documents
            .get(doc_id)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        Ok(DocIdentity {
            doc_id: document.doc_id.clone(),
            canonical_path: document.canonical_path.clone(),
            display_name: document.display_name.clone(),
            format: DocumentFormat::Markdown,
            encoding,
            content_hash: version.content_hash.clone(),
            size_bytes: version.size_bytes,
            last_seen_at_ms,
        })
    }

    #[allow(clippy::too_many_arguments)]
    fn upsert_registration(
        &mut self,
        doc_id: String,
        path: PathBuf,
        canonical_path: String,
        encoding: TextEncoding,
        version: VersionInfo,
        now_ms: i64,
        full_read: bool,
        line_count: u64,
    ) {
        self.paths_index
            .insert(canonical_path.clone(), doc_id.clone());
        let display_name = display_name_for(&path);
        match self.documents.get_mut(&doc_id) {
            Some(document) => {
                document.path = path;
                document.canonical_path = canonical_path;
                document.display_name = display_name;
                document.encoding = encoding;
                document.version = version;
                document.last_seen_at_ms = now_ms;
                document.full_read = full_read;
                document.line_count = line_count;
                document.large_source = None;
            }
            None => {
                let document = RegisteredDocument {
                    doc_id: doc_id.clone(),
                    path,
                    canonical_path,
                    display_name,
                    encoding,
                    version,
                    last_seen_at_ms: now_ms,
                    full_read,
                    line_count,
                    large_source: None,
                };
                self.documents.insert(doc_id, document);
            }
        }
    }

    /// Single (non-stable) read used when the validation snapshot cache no
    /// longer holds the registered version: only byte-identical content may
    /// be served (otherwise `PS_IO_CHANGED`).
    fn reload_registered_snapshot(&mut self, doc_id: &str) -> Result<DocumentSnapshot, AppError> {
        let (path, expected_hash) = {
            let document = self
                .documents
                .get(doc_id)
                .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
            (document.path.clone(), document.version.content_hash.clone())
        };
        let metadata = fs::metadata(&path).map_err(AppError::from_io_read)?;
        let registered_size = self
            .documents
            .get(doc_id)
            .map(|document| document.version.size_bytes)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        if metadata.len() != registered_size {
            return Err(AppError::new(ErrorCode::IoChanged));
        }
        let disk = read_disk_limited(&path, self.config.read_limit_bytes)?;
        let content_hash = sha256_hex(&disk.bytes);
        if content_hash != expected_hash {
            return Err(AppError::new(ErrorCode::IoChanged));
        }
        let (encoding, text) = decode_document(&disk.bytes)?;
        let now = self.timer.now_ms();
        let version = VersionInfo {
            content_hash,
            size_bytes: disk.bytes.len() as u64,
            modified_at_ms: disk.modified_at_ms,
            observed_at_ms: now,
        };
        let line_count = line_count(&text);
        let identity = self.identity_for(doc_id, encoding, &version, now)?;
        let snapshot = DocumentSnapshot {
            doc_id: doc_id.to_owned(),
            identity,
            version: version.clone(),
            text,
            line_count,
        };
        if let Some(document) = self.documents.get_mut(doc_id) {
            document.encoding = encoding;
            document.version = version;
            document.last_seen_at_ms = now;
            document.line_count = line_count;
        }
        self.snapshots.insert(snapshot.clone());
        Ok(snapshot)
    }

    /// `read_document(refresh)` / post-relink stable read (§7.4).
    fn stable_refresh(&mut self, doc_id: &str) -> Result<DocumentSnapshot, AppError> {
        let path = self
            .documents
            .get(doc_id)
            .map(|document| document.path.clone())
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        let window = self.config.stability_window;
        let attempts = self.config.stability_attempts;
        let limit = self.config.read_limit_bytes;
        let timer = self.timer.as_ref();
        let disk = stable_reading(
            || read_disk_limited(&path, limit),
            || timer.wait_stability_window(window),
            attempts,
        )?;
        let (encoding, text) = decode_document(&disk.bytes)?;
        let content_hash = sha256_hex(&disk.bytes);
        let now = self.timer.now_ms();
        let version = VersionInfo {
            content_hash,
            size_bytes: disk.bytes.len() as u64,
            modified_at_ms: disk.modified_at_ms,
            observed_at_ms: now,
        };
        let line_count = line_count(&text);
        let identity = self.identity_for(doc_id, encoding, &version, now)?;
        let snapshot = DocumentSnapshot {
            doc_id: doc_id.to_owned(),
            identity,
            version: version.clone(),
            text,
            line_count,
        };
        if let Some(document) = self.documents.get_mut(doc_id) {
            document.encoding = encoding;
            document.version = version;
            document.last_seen_at_ms = now;
            document.full_read = true;
            document.line_count = line_count;
        }
        self.snapshots.insert(snapshot.clone());
        Ok(snapshot)
    }

    /// Lazily builds/refreshes the line index and hash of a large document.
    /// A cheap stat check short-circuits when the file is unchanged.
    fn ensure_large_source(&mut self, doc_id: &str) -> Result<(), AppError> {
        let (path, stat_matches) = {
            let document = self
                .documents
                .get(doc_id)
                .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
            if document.full_read {
                return Ok(());
            }
            let metadata = fs::metadata(&document.path).map_err(AppError::from_io_read)?;
            let probe = probe_from_metadata(&metadata);
            let stat_matches = document.large_source.as_ref().is_some_and(|source| {
                source.raw_size == probe.size_bytes && source.modified_at_ms == probe.modified_at_ms
            });
            (document.path.clone(), stat_matches)
        };
        if stat_matches {
            return Ok(());
        }
        let source = build_large_source(&path, self.config.stream_chunk_bytes)?;
        let now = self.timer.now_ms();
        let version = VersionInfo {
            content_hash: source.content_hash.clone(),
            size_bytes: source.raw_size,
            modified_at_ms: source.modified_at_ms,
            observed_at_ms: now,
        };
        let line_count = source.line_offsets.len() as u64;
        let encoding = source.encoding;
        if let Some(document) = self.documents.get_mut(doc_id) {
            document.encoding = encoding;
            document.version = version;
            document.last_seen_at_ms = now;
            document.line_count = line_count;
            document.large_source = Some(source);
        }
        Ok(())
    }

    fn large_source_window(
        &mut self,
        request: &ReadSourceWindowRequest,
    ) -> Result<SourceWindow, AppError> {
        self.ensure_large_source(&request.doc_id)?;
        let (path, version, source) = {
            let document = self
                .documents
                .get(&request.doc_id)
                .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
            let source = document.large_source.as_ref().ok_or_else(|| {
                AppError::new(ErrorCode::Internal)
                    .with_message("large document line index is missing")
            })?;
            (
                document.path.clone(),
                document.version.clone(),
                source.clone(),
            )
        };
        let total = source.line_offsets.len() as u64;
        let (start, end) = window_bounds(request.start_line, request.max_lines, total);
        let bom_len = source.raw_size.saturating_sub(source.content_len);
        let start_byte = source.line_offsets[(start - 1) as usize] + bom_len;
        let end_byte = if (end as usize) < source.line_offsets.len() {
            source.line_offsets[end as usize] - 1 + bom_len
        } else {
            source.raw_size
        };
        let mut file = File::open(&path).map_err(AppError::from_io_read)?;
        file.seek(SeekFrom::Start(start_byte))
            .map_err(AppError::from_io_read)?;
        let mut bytes = vec![0u8; (end_byte - start_byte) as usize];
        file.read_exact(&mut bytes)
            .map_err(AppError::from_io_read)?;
        if end < total && bytes.last() == Some(&b'\r') {
            bytes.pop();
        }
        let text = std::str::from_utf8(&bytes)
            .map_err(|_| AppError::new(ErrorCode::EncodingUnsupported))?
            .to_owned();
        let metadata = fs::metadata(&path).map_err(AppError::from_io_read)?;
        let after = probe_from_metadata(&metadata);
        if after.size_bytes != source.raw_size || after.modified_at_ms != source.modified_at_ms {
            return Err(AppError::new(ErrorCode::IoChanged));
        }
        Ok(SourceWindow {
            doc_id: request.doc_id.clone(),
            version,
            start_line: start,
            end_line: end,
            text,
            eof: end == total,
        })
    }

    fn search_full_read(
        &mut self,
        request: &SearchSourceRequest,
    ) -> Result<SourceSearchResult, AppError> {
        let snapshot = match self.cached_snapshot(&request.doc_id) {
            Some(snapshot) => snapshot,
            None => self.reload_registered_snapshot(&request.doc_id)?,
        };
        let (path, registered_hash, version) = {
            let document = self
                .documents
                .get(&request.doc_id)
                .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
            (
                document.path.clone(),
                document.version.content_hash.clone(),
                document.version.clone(),
            )
        };
        let metadata = fs::metadata(&path).map_err(AppError::from_io_read)?;
        let before = probe_from_metadata(&metadata);
        let offsets = line_offsets(&snapshot.text);
        let total_bytes = snapshot.text.len() as u64;
        let mut scanner = SourceScanner::new(
            &request.query,
            request.case_sensitive,
            request.max_results,
            self.config.search_budget_bytes,
            &offsets,
        );
        let outcome = scanner.run(
            TextChunks::new(&snapshot.text, self.config.stream_chunk_bytes),
            total_bytes,
        )?;
        confirm_version_unchanged(&path, &registered_hash, before)?;
        Ok(SourceSearchResult {
            doc_id: request.doc_id.clone(),
            version,
            matches: outcome.matches,
            scanned_bytes: outcome.scanned_bytes,
            total_bytes,
            complete: outcome.complete,
        })
    }

    fn search_large_source(
        &mut self,
        request: &SearchSourceRequest,
    ) -> Result<SourceSearchResult, AppError> {
        self.ensure_large_source(&request.doc_id)?;
        let (path, version, source) = {
            let document = self
                .documents
                .get(&request.doc_id)
                .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
            let source = document.large_source.as_ref().ok_or_else(|| {
                AppError::new(ErrorCode::Internal)
                    .with_message("large document line index is missing")
            })?;
            (
                document.path.clone(),
                document.version.clone(),
                source.clone(),
            )
        };
        let registered_hash = source.content_hash.clone();
        let metadata = fs::metadata(&path).map_err(AppError::from_io_read)?;
        let before = probe_from_metadata(&metadata);
        let file = File::open(&path).map_err(AppError::from_io_read)?;
        let mut chunks = DecodedFileChunks::new(file, self.config.stream_chunk_bytes)?;
        let mut scanner = SourceScanner::new(
            &request.query,
            request.case_sensitive,
            request.max_results,
            self.config.search_budget_bytes,
            &source.line_offsets,
        );
        let outcome = scanner.run(&mut chunks, source.content_len)?;
        if outcome.to_end && chunks.hash_hex() != registered_hash {
            return Err(AppError::new(ErrorCode::IoChanged));
        }
        confirm_version_unchanged(&path, &registered_hash, before)?;
        Ok(SourceSearchResult {
            doc_id: request.doc_id.clone(),
            version,
            matches: outcome.matches,
            scanned_bytes: outcome.scanned_bytes,
            total_bytes: source.content_len,
            complete: outcome.complete,
        })
    }
}

fn resolve_open_target(raw_path: &str) -> Result<PathBuf, AppError> {
    if !paths::has_markdown_extension(Path::new(raw_path)) {
        return Err(AppError::new(ErrorCode::FormatUnsupported)
            .with_message("only .md/.markdown documents are supported"));
    }
    let canonical = fs::canonicalize(raw_path).map_err(AppError::from_io_read)?;
    let metadata = fs::metadata(&canonical).map_err(AppError::from_io_read)?;
    if !metadata.is_file() {
        return Err(AppError::new(ErrorCode::FormatUnsupported)
            .with_message("target is not a regular file (directories are not documents)"));
    }
    File::open(&canonical).map_err(AppError::from_io_read)?;
    Ok(canonical)
}

fn read_probe(file: &mut File, limit: usize) -> Result<Vec<u8>, AppError> {
    let mut buffer = vec![0u8; limit];
    let mut filled = 0usize;
    while filled < limit {
        let read = file
            .read(&mut buffer[filled..])
            .map_err(AppError::from_io_read)?;
        if read == 0 {
            break;
        }
        filled += read;
    }
    buffer.truncate(filled);
    Ok(buffer)
}

fn hash_reader(file: &mut File) -> Result<String, AppError> {
    file.seek(SeekFrom::Start(0))
        .map_err(AppError::from_io_read)?;
    let mut hasher = Sha256::new();
    let mut scratch = [0u8; READ_SCRATCH_BYTES];
    loop {
        let read = file.read(&mut scratch).map_err(AppError::from_io_read)?;
        if read == 0 {
            break;
        }
        hasher.update(&scratch[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

fn build_large_source(path: &Path, chunk_bytes: usize) -> Result<LargeSource, AppError> {
    let file = File::open(path).map_err(AppError::from_io_read)?;
    let mut chunks = DecodedFileChunks::new(file, chunk_bytes)?;
    let mut line_offsets = vec![0u64];
    let mut content_len = 0u64;
    for item in &mut chunks {
        let (absolute, text) = item?;
        for (index, byte) in text.bytes().enumerate() {
            if byte == b'\n' {
                line_offsets.push(absolute + index as u64 + 1);
            }
        }
        content_len += text.len() as u64;
    }
    let metadata = fs::metadata(path).map_err(AppError::from_io_read)?;
    let encoding = if chunks.bom_seen() {
        TextEncoding::Utf8Bom
    } else {
        TextEncoding::Utf8
    };
    Ok(LargeSource {
        content_hash: chunks.hash_hex(),
        raw_size: metadata.len(),
        content_len,
        modified_at_ms: system_time_to_ms(metadata.modified().unwrap_or(UNIX_EPOCH)),
        encoding,
        line_offsets,
    })
}

fn confirm_version_unchanged(
    path: &Path,
    expected_hash: &str,
    before: DiskProbe,
) -> Result<(), AppError> {
    let metadata = match fs::metadata(path) {
        Ok(metadata) => metadata,
        Err(_) => return Err(AppError::new(ErrorCode::IoChanged)),
    };
    let after = probe_from_metadata(&metadata);
    if after == before {
        return Ok(());
    }
    match hash_file(path) {
        Ok((hash, _)) if hash == expected_hash => Ok(()),
        _ => Err(AppError::new(ErrorCode::IoChanged)),
    }
}

fn display_name_for(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

fn identity_from(
    doc_id: &str,
    canonical_path: &str,
    path: &Path,
    encoding: TextEncoding,
    version: &VersionInfo,
    last_seen_at_ms: i64,
) -> DocIdentity {
    DocIdentity {
        doc_id: doc_id.to_owned(),
        canonical_path: canonical_path.to_owned(),
        display_name: display_name_for(path),
        format: DocumentFormat::Markdown,
        encoding,
        content_hash: version.content_hash.clone(),
        size_bytes: version.size_bytes,
        last_seen_at_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn decode_handles_bom_binary_empty_and_crlf() {
        let (encoding, text) = decode_document(b"").unwrap();
        assert_eq!(encoding, TextEncoding::Utf8);
        assert_eq!(text, "");

        let (encoding, text) = decode_document("a\r\nb".as_bytes()).unwrap();
        assert_eq!(encoding, TextEncoding::Utf8);
        assert_eq!(text, "a\r\nb");

        let mut with_bom = UTF8_BOM.to_vec();
        with_bom.extend_from_slice("# 标题\n".as_bytes());
        let (encoding, text) = decode_document(&with_bom).unwrap();
        assert_eq!(encoding, TextEncoding::Utf8Bom);
        assert_eq!(text, "# 标题\n");

        assert_eq!(
            decode_document(&[0x00, 0x01]).unwrap_err().code(),
            ErrorCode::EncodingUnsupported
        );
        assert_eq!(
            decode_document(b"caf\xe9 na\xefve").map_err(|error| error.code()),
            Err(ErrorCode::EncodingUnsupported)
        );
    }

    #[test]
    fn line_count_and_offsets_match_split_semantics() {
        assert_eq!(line_count(""), 1);
        assert_eq!(line_count("a\nb"), 2);
        assert_eq!(line_count("a\n"), 2);
        assert_eq!(line_count("a\r\nb"), 2);
        assert_eq!(line_offsets("a\nb"), vec![0, 2]);
        assert_eq!(line_offsets("a\n"), vec![0, 2]);
        assert_eq!(line_offsets(""), vec![0]);
        assert_eq!(line_offsets("中\n🚀x"), vec![0, 4]);
    }

    #[test]
    fn line_for_offset_is_one_based() {
        let offsets = line_offsets("ab\ncd\nef");
        assert_eq!(line_for_offset(&offsets, 0), 1);
        assert_eq!(line_for_offset(&offsets, 2), 1);
        assert_eq!(line_for_offset(&offsets, 3), 2);
        assert_eq!(line_for_offset(&offsets, 6), 3);
        assert_eq!(line_for_offset(&offsets, 7), 3);
    }

    #[test]
    fn window_bounds_clamp_to_document() {
        assert_eq!(window_bounds(1, 1, 3), (1, 1));
        assert_eq!(window_bounds(2, 10, 3), (2, 3));
        assert_eq!(window_bounds(9, 10, 3), (3, 3));
        assert_eq!(window_bounds(1, 2000, 1), (1, 1));
    }

    #[test]
    fn stable_reading_returns_only_identical_double_reads() {
        let reads = Cell::new(0);
        let result = stable_reading(
            || {
                reads.set(reads.get() + 1);
                Ok(vec![1u8, 2, 3])
            },
            || {},
            5,
        )
        .unwrap();
        assert_eq!(result, vec![1, 2, 3]);
        assert_eq!(reads.get(), 2);
    }

    #[test]
    fn stable_reading_gives_up_with_io_changed_after_n_attempts() {
        let reads = Cell::new(0u64);
        let error = stable_reading(
            || {
                reads.set(reads.get() + 1);
                Ok(vec![reads.get() as u8])
            },
            || {},
            5,
        )
        .unwrap_err();
        assert_eq!(error.code(), ErrorCode::IoChanged);
        assert_eq!(reads.get(), 10);
    }

    #[test]
    fn stable_reading_rejects_zero_attempts() {
        let error = stable_reading(|| Ok(vec![1u8]), || {}, 0).unwrap_err();
        assert_eq!(error.code(), ErrorCode::Internal);
    }

    #[test]
    fn scanner_finds_cross_chunk_matches_without_duplicates() {
        let text = "aaaaab";
        let offsets = line_offsets(text);
        let mut scanner = SourceScanner::new("aa", true, 100, u64::MAX, &offsets);
        let outcome = scanner
            .run(TextChunks::new(text, 1), text.len() as u64)
            .unwrap();
        let ranges: Vec<(u64, u64)> = outcome
            .matches
            .iter()
            .map(|found| (found.start_byte, found.end_byte))
            .collect();
        // Leftmost, non-overlapping, identical to a single-buffer scan.
        assert_eq!(ranges, vec![(0, 2), (2, 4)]);
        assert!(outcome.complete);

        let text = "xyabc z";
        let offsets = line_offsets(text);
        let mut scanner = SourceScanner::new("abc", true, 100, u64::MAX, &offsets);
        let outcome = scanner
            .run(TextChunks::new(text, 2), text.len() as u64)
            .unwrap();
        assert_eq!(outcome.matches.len(), 1);
        assert_eq!(outcome.matches[0].start_byte, 2);
        assert_eq!(outcome.matches[0].end_byte, 5);
    }

    #[test]
    fn fold_segment_maps_case_insensitive_bytes_to_original_range() {
        let segment = fold_segment("A中İ", 10, false);
        assert_eq!(segment.folded, "a中i\u{307}");
        // "A" folds to one byte at [10, 11).
        assert_eq!(segment.mapping[0], (10, 11));
        // "中" folds unchanged at [11, 14).
        assert_eq!(segment.mapping[1], (11, 14));
        assert_eq!(segment.mapping[3], (11, 14));
        // "İ" (2 bytes) folds to "i" + combining dot (3 bytes) at [14, 16).
        assert!(segment.mapping[4..7].iter().all(|range| *range == (14, 16)));
    }
}
