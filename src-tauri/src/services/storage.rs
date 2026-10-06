//! SQLite storage service: connection setup, schema v1 and the forward-only
//! migration framework (T-12), repositories with the write gate and
//! categorized clearing (T-13), and deterministic failure-injection seams
//! (T-14).
//!
//! Authority: `data-model.md` §2–§7, ADR-004, contracts §2.1/§3.4. Paths are
//! always supplied by the caller (`appDataDir` / `appCacheDir`), so no
//! database or cache file can land in a user source directory (R04/NF01).
//! This module adds service APIs only; the Tauri command surface is wired by
//! wp-15, which is also responsible for `spawn_blocking`.
//!
//! Error mapping: failures while opening or migrating the database (missing
//! permission, corruption, disk full, newer schema revision) are
//! `PS_DB_MIGRATION` and the file is preserved untouched (NF08; data-model
//! §4.4); failures inside repositories are `PS_DB_FAILURE`. Suppressed or
//! failed record writes are returned as `SaveResult { saved: false, .. }`
//! instead of exceptions (ADR-004 §6; INV-AR-06/INV-WB-01).

use std::collections::BTreeMap;
use std::fmt;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use rusqlite::{params, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::{AppError, ErrorCode};
use crate::models::{
    AnchorRecord, ClearResult, DocumentFormat, GlobalSettings, GlobalSettingsPatch, GrantKind,
    GrantRecord, GrantScope, PositionRecord, RecentEntry, SaveResult, SessionSnapshot, SessionTab,
    StorageCategory, StorageCategoryInfo, StorageOverview, TextEncoding, Theme,
};
use crate::services::auth::GrantPersistence;
use crate::services::paths::PathProbe;

/// Database file name inside `appDataDir` (data-model §1).
pub const DATABASE_FILE_NAME: &str = "paperstack.sqlite3";

/// Schema revision this build writes (`PRAGMA user_version`; data-model §2/§4).
pub const SCHEMA_REVISION: u32 = 1;

/// `PRAGMA busy_timeout` (ms) from data-model §2.
pub const BUSY_TIMEOUT_MS: u32 = 3000;

/// Recents cap frozen by SRS §6.1 (data-model §5).
pub const RECENTS_LIMIT: usize = 100;

/// Cache cap frozen by SRS §6.1: 256 MiB (data-model §5/§7).
pub const CACHE_MAX_BYTES: u64 = 256 * 1024 * 1024;

/// Single `sidebar_state.state_json` size cap (data-model §2).
pub const SIDEBAR_STATE_MAX_BYTES: usize = 64 * 1024;

/// `GlobalSettings.fontSizePx` range (data-model §5, R23).
pub const FONT_SIZE_PX_MIN: u32 = 14;
pub const FONT_SIZE_PX_MAX: u32 = 24;
/// `GlobalSettings.lineHeight` range (data-model §5, R23).
pub const LINE_HEIGHT_MIN: f64 = 1.5;
pub const LINE_HEIGHT_MAX: f64 = 2.2;
/// `GlobalSettings.maxContentWidthPx` range (data-model §5, R23).
pub const MAX_CONTENT_WIDTH_PX_MIN: u32 = 560;
pub const MAX_CONTENT_WIDTH_PX_MAX: u32 = 960;

const SETTING_THEME: &str = "display.theme";
const SETTING_FONT_SIZE_PX: &str = "display.fontSizePx";
const SETTING_LINE_HEIGHT: &str = "display.lineHeight";
const SETTING_MAX_CONTENT_WIDTH_PX: &str = "display.maxContentWidthPx";
const SETTING_SYNTAX_MODE: &str = "syntax.mode";
const SETTING_UPDATE_MODE_DEFAULT: &str = "update.modeDefault";
const SETTING_RESTORE_SESSION: &str = "startup.restoreSession";
const SETTING_REMEMBER_RECORDS: &str = "privacy.rememberRecords";

const META_ACTIVE_TAB_ID: &str = "active_tab_id";
const META_SAVED_AT_MS: &str = "saved_at_ms";

// ---------------------------------------------------------------------------
// Schema v1 (data-model §2, verbatim) and the migration framework (T-12)
// ---------------------------------------------------------------------------

/// v1 DDL exactly as specified by data-model §2. All tables are `STRICT`.
pub const SCHEMA_V1_SQL: &str = r#"
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL              -- epoch ms
) STRICT;

CREATE TABLE documents (
  doc_id         TEXT PRIMARY KEY,         -- "d-<hex16>" (data-model §3.1)
  canonical_path TEXT NOT NULL UNIQUE,
  display_name   TEXT NOT NULL,
  format         TEXT NOT NULL CHECK (format IN ('markdown')),
  encoding       TEXT NOT NULL CHECK (encoding IN ('utf-8','utf-8-bom')),
  content_hash   TEXT,                     -- sha256 hex; last successful read
  size_bytes     INTEGER,
  last_seen_at   INTEGER NOT NULL          -- epoch ms
) STRICT;

CREATE TABLE recents (
  doc_id     TEXT PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
  opened_at  INTEGER NOT NULL,             -- epoch ms; list ordered desc, cap 100
  last_path  TEXT NOT NULL                 -- last known path (lost-file prompt)
) STRICT;

CREATE TABLE positions (
  doc_id            TEXT PRIMARY KEY REFERENCES documents(doc_id) ON DELETE CASCADE,
  version_hash      TEXT NOT NULL,
  heading_path_json TEXT NOT NULL DEFAULT '[]',
  block_fingerprint TEXT,
  offset_ratio      REAL NOT NULL DEFAULT 0.0 CHECK (offset_ratio >= 0.0 AND offset_ratio <= 1.0),
  source_range_json TEXT,                  -- {"startByte":n,"endByte":n}
  updated_at        INTEGER NOT NULL
) STRICT;

CREATE TABLE session_tabs (
  tab_id      TEXT PRIMARY KEY,
  doc_id      TEXT NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0,1)),
  updated_at  INTEGER NOT NULL
) STRICT;

CREATE TABLE session_meta (
  key        TEXT PRIMARY KEY,             -- e.g. "active_tab_id", "saved_at_ms"
  value_json TEXT NOT NULL
) STRICT;

CREATE TABLE sidebar_state (
  kind        TEXT NOT NULL CHECK (kind IN ('directory','document')),
  state_key   TEXT NOT NULL,               -- directory: canonical path; document: doc_id
  state_json  TEXT NOT NULL,               -- expansion/scroll UI state, never content
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (kind, state_key)
) STRICT;

CREATE TABLE authorizations (
  grant_id          TEXT PRIMARY KEY,      -- "g-<hex16>" (data-model §3.2)
  kind              TEXT NOT NULL CHECK (kind IN ('file','directory','remote')),
  canonical_path    TEXT,                  -- required for file/directory
  origins_json      TEXT,                  -- remote: ["https://host"]
  scope             TEXT NOT NULL CHECK (scope IN ('session','persistent')),
  source_doc_id     TEXT,                  -- initiating session (remote required)
  granted_at        INTEGER NOT NULL,
  last_confirmed_at INTEGER,
  CHECK ((kind = 'remote' AND origins_json IS NOT NULL) OR (kind != 'remote' AND canonical_path IS NOT NULL))
) STRICT;

CREATE TABLE cache_meta (
  cache_key        TEXT PRIMARY KEY,       -- "c-<hex16>" (URL hash)
  kind             TEXT NOT NULL CHECK (kind IN ('remote-image')),
  rel_path         TEXT NOT NULL,          -- relative to cacheDir, no traversal
  size_bytes       INTEGER NOT NULL,
  source_url_hash  TEXT,
  created_at       INTEGER NOT NULL,
  last_access_at   INTEGER NOT NULL
) STRICT;

CREATE INDEX idx_recents_opened       ON recents(opened_at DESC);
CREATE INDEX idx_positions_updated    ON positions(updated_at);
CREATE INDEX idx_session_tabs_order   ON session_tabs(order_index);
CREATE INDEX idx_auth_scope           ON authorizations(scope);
CREATE INDEX idx_cache_last_access    ON cache_meta(last_access_at);
"#;

/// One forward migration step. `apply` receives a transaction; returning an
/// error rolls the whole step back (data-model §4.3).
pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub apply: fn(&Transaction<'_>) -> rusqlite::Result<()>,
}

fn apply_v1(transaction: &Transaction<'_>) -> rusqlite::Result<()> {
    transaction.execute_batch(SCHEMA_V1_SQL)
}

static MIGRATIONS: [Migration; 1] = [Migration {
    version: 1,
    name: "initial schema",
    apply: apply_v1,
}];

/// The production migration list (`v0 → v1`). Forward-only (data-model §4).
pub fn default_migrations() -> &'static [Migration] {
    &MIGRATIONS
}

/// Runs pending migrations, one transaction per step, and returns the final
/// `PRAGMA user_version`. Idempotent for an up-to-date database. A database
/// newer than the last known migration is refused with `PS_DB_MIGRATION` and
/// never downgraded (data-model §4.1/§4.5).
pub fn migrate_connection(
    connection: &mut Connection,
    migrations: &[Migration],
) -> Result<u32, AppError> {
    let current = read_user_version(connection).map_err(migration_error)?;
    let target = migrations
        .iter()
        .map(|migration| migration.version)
        .max()
        .unwrap_or(0);
    if current > target {
        return Err(AppError::new(ErrorCode::DbMigration).with_message(format!(
            "database schema revision {current} is newer than supported revision {target}; \
             refusing to downgrade"
        )));
    }
    let mut current = current;
    for migration in migrations {
        if migration.version <= current {
            continue;
        }
        if migration.version != current + 1 {
            return Err(AppError::new(ErrorCode::DbMigration).with_message(format!(
                "migration list is not contiguous: expected revision {}, found {}",
                current + 1,
                migration.version
            )));
        }
        let transaction = connection.transaction().map_err(migration_error)?;
        (migration.apply)(&transaction).map_err(migration_error)?;
        transaction
            .pragma_update(None, "user_version", migration.version)
            .map_err(migration_error)?;
        transaction.commit().map_err(migration_error)?;
        current = migration.version;
    }
    Ok(current)
}

fn read_user_version(connection: &Connection) -> rusqlite::Result<u32> {
    connection
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .map(|value| u32::try_from(value).unwrap_or(0))
}

fn read_schema_version(connection: &Connection) -> rusqlite::Result<i64> {
    connection.query_row("PRAGMA schema_version", [], |row| row.get(0))
}

// ---------------------------------------------------------------------------
// Connection setup and Storage handle
// ---------------------------------------------------------------------------

/// Stored document identity row (data-model §2 `documents`, §3.1). Unlike the
/// wire `DocIdentity`, `content_hash`/`size_bytes` are nullable because the
/// table records a document before its first successful read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentRecord {
    pub doc_id: String,
    pub canonical_path: String,
    pub display_name: String,
    pub format: DocumentFormat,
    pub encoding: TextEncoding,
    pub content_hash: Option<String>,
    pub size_bytes: Option<u64>,
    pub last_seen_at_ms: i64,
}

/// One `cache_meta` row (data-model §2/§7). `kind` is fixed to
/// `remote-image` in v1 and therefore not carried as a field.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CacheEntry {
    pub cache_key: String,
    pub rel_path: String,
    pub size_bytes: u64,
    pub source_url_hash: Option<String>,
    pub created_at_ms: i64,
    pub last_access_at_ms: i64,
}

/// One LRU enforcement pass over `cache_meta` (data-model §7).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CacheEvictionReport {
    /// Metadata rows removed (files deleted or already missing).
    pub evicted: u64,
    /// Bytes of the removed files.
    pub freed_bytes: u64,
    /// Rows kept because the file could not be deleted; retried next pass.
    pub failures: u64,
    /// Rows removed because `rel_path` was unsafe to resolve (metadata only).
    pub unsafe_paths: u64,
}

/// `sidebar_state.kind` (data-model §2).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SidebarKind {
    Directory,
    Document,
}

impl SidebarKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            SidebarKind::Directory => "directory",
            SidebarKind::Document => "document",
        }
    }
}

/// Single-connection SQLite storage (ADR-004 option B). Cloneable so Tauri
/// managed state and `spawn_blocking` closures can share one connection
/// behind its `Mutex`.
#[derive(Clone)]
pub struct Storage {
    inner: Arc<StorageInner>,
}

/// In-memory session suppression flags set by clear/privacy actions for
/// `recents`/`positions`/`session` only (data-model §6).
#[derive(Debug, Default)]
struct SuppressionState {
    recents: bool,
    positions: bool,
    session: bool,
}

impl SuppressionState {
    fn contains(&self, category: StorageCategory) -> bool {
        match category {
            StorageCategory::Recents => self.recents,
            StorageCategory::Positions => self.positions,
            StorageCategory::Session => self.session,
            StorageCategory::Cache | StorageCategory::Authorizations | StorageCategory::Logs => {
                false
            }
        }
    }

    fn insert(&mut self, category: StorageCategory) {
        match category {
            StorageCategory::Recents => self.recents = true,
            StorageCategory::Positions => self.positions = true,
            StorageCategory::Session => self.session = true,
            StorageCategory::Cache | StorageCategory::Authorizations | StorageCategory::Logs => {}
        }
    }

    fn remove(&mut self, category: StorageCategory) {
        match category {
            StorageCategory::Recents => self.recents = false,
            StorageCategory::Positions => self.positions = false,
            StorageCategory::Session => self.session = false,
            StorageCategory::Cache | StorageCategory::Authorizations | StorageCategory::Logs => {}
        }
    }

    fn clear(&mut self) {
        self.recents = false;
        self.positions = false;
        self.session = false;
    }
}

struct StorageInner {
    connection: Mutex<Connection>,
    path: PathBuf,
    read_only: bool,
    /// In-memory session suppression flags set by clear/privacy actions for
    /// `recents`/`positions`/`session` only (data-model §6).
    gate: Mutex<SuppressionState>,
    /// Mirror of `privacy.rememberRecords` for the write gate; refreshed on
    /// every successful settings write.
    remember_records: AtomicBool,
    /// In-memory settings revision (contracts §3.5 `SettingsBundle.revision`);
    /// the contract leaves its exact semantics open, see the evidence report.
    settings_revision: AtomicU64,
}

impl fmt::Debug for Storage {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Storage")
            .field("path", &self.inner.path)
            .field("read_only", &self.inner.read_only)
            .finish_non_exhaustive()
    }
}

impl Storage {
    /// Opens `<data_dir>/paperstack.sqlite3`, applies the connection pragmas
    /// from data-model §2 and migrates to [`SCHEMA_REVISION`].
    pub fn open(data_dir: impl AsRef<Path>) -> Result<Self, AppError> {
        Self::open_path(&data_dir.as_ref().join(DATABASE_FILE_NAME))
    }

    /// Opens an explicit database path. Any open/migration failure is
    /// `PS_DB_MIGRATION`; the file is left exactly as it was (NF08; no silent
    /// wipe or overwrite).
    pub fn open_path(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).map_err(open_error)?;
            }
        }
        let mut connection = Connection::open(path).map_err(open_error)?;
        configure_read_write_connection(&connection)?;
        migrate_connection(&mut connection, default_migrations())?;
        Self::finish_open(connection, path, false)
    }

    /// Read-only degraded open (data-model §4.5): no migration, `query_only`
    /// enforced, usable for the “newer revision” and memory-degrade paths.
    pub fn open_read_only_path(path: &Path) -> Result<Self, AppError> {
        let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(open_error)?;
        connection
            .busy_timeout(Duration::from_millis(u64::from(BUSY_TIMEOUT_MS)))
            .map_err(open_error)?;
        connection
            .execute_batch("PRAGMA foreign_keys=ON; PRAGMA query_only=ON;")
            .map_err(open_error)?;
        Self::finish_open(connection, path, true)
    }

    fn finish_open(connection: Connection, path: &Path, read_only: bool) -> Result<Self, AppError> {
        if read_only {
            // Touch the header so a corrupt file cannot silently enter the
            // read-only degrade path.
            read_schema_version(&connection).map_err(open_error)?;
        }
        let storage = Self {
            inner: Arc::new(StorageInner {
                connection: Mutex::new(connection),
                path: path.to_path_buf(),
                read_only,
                gate: Mutex::new(SuppressionState::default()),
                remember_records: AtomicBool::new(true),
                settings_revision: AtomicU64::new(0),
            }),
        };
        let remember = match storage.load_settings() {
            Ok(settings) => settings.remember_records,
            Err(_) if read_only => true,
            Err(error) => {
                return Err(AppError::new(ErrorCode::DbMigration)
                    .with_message("settings are unreadable after migration")
                    .with_source(error))
            }
        };
        storage
            .inner
            .remember_records
            .store(remember, Ordering::SeqCst);
        Ok(storage)
    }

    pub fn database_path(&self) -> &Path {
        &self.inner.path
    }

    pub fn is_read_only(&self) -> bool {
        self.inner.read_only
    }

    pub fn remember_records(&self) -> bool {
        self.inner.remember_records.load(Ordering::SeqCst)
    }

    pub fn settings_revision(&self) -> u64 {
        self.inner.settings_revision.load(Ordering::SeqCst)
    }

    /// Current schema revision (`PRAGMA user_version`).
    pub fn schema_revision(&self) -> Result<u32, AppError> {
        read_user_version(&self.connection()).map_err(db_error)
    }

    /// Failure-injection / maintenance seam: caps database growth
    /// (`PRAGMA max_page_count`). Used by NF08 tests to simulate “disk full”
    /// deterministically; returns the effective limit.
    pub fn set_max_page_count(&self, pages: u32) -> Result<u32, AppError> {
        let connection = self.connection();
        connection
            .pragma_update(None, "max_page_count", pages)
            .map_err(db_error)?;
        connection
            .query_row("PRAGMA max_page_count", [], |row| row.get(0))
            .map_err(db_error)
    }

    fn connection(&self) -> MutexGuard<'_, Connection> {
        self.inner
            .connection
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn gate(&self) -> MutexGuard<'_, SuppressionState> {
        self.inner
            .gate
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn configure_read_write_connection(connection: &Connection) -> Result<(), AppError> {
    connection
        .busy_timeout(Duration::from_millis(u64::from(BUSY_TIMEOUT_MS)))
        .map_err(open_error)?;
    let journal_mode: String = connection
        .query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))
        .map_err(open_error)?;
    if !journal_mode.eq_ignore_ascii_case("wal") {
        return Err(AppError::new(ErrorCode::DbMigration)
            .with_message(format!("journal_mode is {journal_mode}; WAL is required")));
    }
    connection
        .execute_batch("PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;")
        .map_err(open_error)
}

fn open_error(error: impl Into<Box<dyn std::error::Error + Send + Sync + 'static>>) -> AppError {
    AppError::new(ErrorCode::DbMigration).with_source(error)
}

fn migration_error(
    error: impl Into<Box<dyn std::error::Error + Send + Sync + 'static>>,
) -> AppError {
    AppError::new(ErrorCode::DbMigration).with_source(error)
}

fn db_error(error: rusqlite::Error) -> AppError {
    AppError::new(ErrorCode::DbFailure).with_source(error)
}

fn json_error(error: serde_json::Error) -> AppError {
    AppError::new(ErrorCode::DbFailure).with_source(error)
}

// ---------------------------------------------------------------------------
// Settings repository (data-model §5)
// ---------------------------------------------------------------------------

fn parse_setting<T: DeserializeOwned>(map: &BTreeMap<String, String>, key: &str) -> Option<T> {
    map.get(key).and_then(|raw| serde_json::from_str(raw).ok())
}

fn settings_from_map(map: &BTreeMap<String, String>) -> GlobalSettings {
    let defaults = GlobalSettings::default();
    GlobalSettings {
        theme: parse_setting::<Theme>(map, SETTING_THEME).unwrap_or(defaults.theme),
        font_size_px: parse_setting::<u32>(map, SETTING_FONT_SIZE_PX)
            .filter(|value| (FONT_SIZE_PX_MIN..=FONT_SIZE_PX_MAX).contains(value))
            .unwrap_or(defaults.font_size_px),
        line_height: parse_setting::<f64>(map, SETTING_LINE_HEIGHT)
            .filter(|value| {
                value.is_finite() && (LINE_HEIGHT_MIN..=LINE_HEIGHT_MAX).contains(value)
            })
            .unwrap_or(defaults.line_height),
        max_content_width_px: parse_setting::<u32>(map, SETTING_MAX_CONTENT_WIDTH_PX)
            .filter(|value| (MAX_CONTENT_WIDTH_PX_MIN..=MAX_CONTENT_WIDTH_PX_MAX).contains(value))
            .unwrap_or(defaults.max_content_width_px),
        syntax_mode: parse_setting(map, SETTING_SYNTAX_MODE).unwrap_or(defaults.syntax_mode),
        update_mode_default: parse_setting(map, SETTING_UPDATE_MODE_DEFAULT)
            .unwrap_or(defaults.update_mode_default),
        restore_session: parse_setting(map, SETTING_RESTORE_SESSION)
            .unwrap_or(defaults.restore_session),
        remember_records: parse_setting(map, SETTING_REMEMBER_RECORDS)
            .unwrap_or(defaults.remember_records),
    }
}

impl Storage {
    /// Typed settings with the SRS §6.1 defaults for every missing field; a
    /// corrupt or out-of-range stored value falls back to that field's default
    /// (R23). A query-level failure returns `PS_DB_FAILURE`; the command layer
    /// may then serve defaults in the memory-degrade path (contract §2 command
    /// 22).
    pub fn load_settings(&self) -> Result<GlobalSettings, AppError> {
        let connection = self.connection();
        let mut statement = connection
            .prepare("SELECT key, value_json FROM settings")
            .map_err(db_error)?;
        let rows = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(db_error)?;
        let mut map = BTreeMap::new();
        for row in rows {
            let (key, value) = row.map_err(db_error)?;
            map.insert(key, value);
        }
        Ok(settings_from_map(&map))
    }

    /// Applies a patch: valid fields are persisted, out-of-range fields keep
    /// the previous value (R23; `applied`/`persisted` separation is handled by
    /// the command layer). Returns the effective settings. A database failure
    /// returns `PS_DB_FAILURE`; callers keep the in-memory applied value.
    pub fn update_settings(
        &self,
        patch: &GlobalSettingsPatch,
        now_ms: i64,
    ) -> Result<GlobalSettings, AppError> {
        let current = self.load_settings()?;
        let mut next = current.clone();
        let mut changed = false;
        if let Some(theme) = patch.theme {
            next.theme = theme;
            changed = true;
        }
        if let Some(value) = patch.font_size_px {
            if (FONT_SIZE_PX_MIN..=FONT_SIZE_PX_MAX).contains(&value) {
                next.font_size_px = value;
                changed = true;
            }
        }
        if let Some(value) = patch.line_height {
            if value.is_finite() && (LINE_HEIGHT_MIN..=LINE_HEIGHT_MAX).contains(&value) {
                next.line_height = value;
                changed = true;
            }
        }
        if let Some(value) = patch.max_content_width_px {
            if (MAX_CONTENT_WIDTH_PX_MIN..=MAX_CONTENT_WIDTH_PX_MAX).contains(&value) {
                next.max_content_width_px = value;
                changed = true;
            }
        }
        if let Some(mode) = patch.syntax_mode {
            next.syntax_mode = mode;
            changed = true;
        }
        if let Some(mode) = patch.update_mode_default {
            next.update_mode_default = mode;
            changed = true;
        }
        if let Some(value) = patch.restore_session {
            next.restore_session = value;
            changed = true;
        }
        if let Some(value) = patch.remember_records {
            next.remember_records = value;
            changed = true;
        }
        if changed {
            self.write_settings(&next, now_ms)?;
            self.inner
                .remember_records
                .store(next.remember_records, Ordering::SeqCst);
            self.inner.settings_revision.fetch_add(1, Ordering::SeqCst);
        }
        Ok(next)
    }

    /// Persists the full settings bundle; used for tests and defaults seeding.
    pub fn store_settings(&self, settings: &GlobalSettings, now_ms: i64) -> Result<(), AppError> {
        self.write_settings(settings, now_ms)?;
        self.inner
            .remember_records
            .store(settings.remember_records, Ordering::SeqCst);
        self.inner.settings_revision.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    fn write_settings(&self, settings: &GlobalSettings, now_ms: i64) -> Result<(), AppError> {
        let mut connection = self.connection();
        let transaction = connection.transaction().map_err(db_error)?;
        write_setting(&transaction, SETTING_THEME, &settings.theme, now_ms)?;
        write_setting(
            &transaction,
            SETTING_FONT_SIZE_PX,
            &settings.font_size_px,
            now_ms,
        )?;
        write_setting(
            &transaction,
            SETTING_LINE_HEIGHT,
            &settings.line_height,
            now_ms,
        )?;
        write_setting(
            &transaction,
            SETTING_MAX_CONTENT_WIDTH_PX,
            &settings.max_content_width_px,
            now_ms,
        )?;
        write_setting(
            &transaction,
            SETTING_SYNTAX_MODE,
            &settings.syntax_mode,
            now_ms,
        )?;
        write_setting(
            &transaction,
            SETTING_UPDATE_MODE_DEFAULT,
            &settings.update_mode_default,
            now_ms,
        )?;
        write_setting(
            &transaction,
            SETTING_RESTORE_SESSION,
            &settings.restore_session,
            now_ms,
        )?;
        write_setting(
            &transaction,
            SETTING_REMEMBER_RECORDS,
            &settings.remember_records,
            now_ms,
        )?;
        transaction.commit().map_err(db_error)
    }
}

fn write_setting<T: Serialize>(
    transaction: &Transaction<'_>,
    key: &str,
    value: &T,
    now_ms: i64,
) -> Result<(), AppError> {
    let value_json = serde_json::to_string(value).map_err(json_error)?;
    transaction
        .execute(
            "INSERT INTO settings (key, value_json, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET
               value_json = excluded.value_json, updated_at = excluded.updated_at",
            params![key, value_json, now_ms],
        )
        .map_err(db_error)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Document identity repository (data-model §3.1)
// ---------------------------------------------------------------------------

fn format_str(format: DocumentFormat) -> &'static str {
    match format {
        DocumentFormat::Markdown => "markdown",
    }
}

fn encoding_str(encoding: TextEncoding) -> &'static str {
    match encoding {
        TextEncoding::Utf8 => "utf-8",
        TextEncoding::Utf8Bom => "utf-8-bom",
    }
}

fn parse_format(value: &str) -> Result<DocumentFormat, AppError> {
    match value {
        "markdown" => Ok(DocumentFormat::Markdown),
        other => Err(AppError::new(ErrorCode::DbFailure)
            .with_message(format!("unknown document format {other:?} in database"))),
    }
}

fn parse_encoding(value: &str) -> Result<TextEncoding, AppError> {
    match value {
        "utf-8" => Ok(TextEncoding::Utf8),
        "utf-8-bom" => Ok(TextEncoding::Utf8Bom),
        other => Err(AppError::new(ErrorCode::DbFailure)
            .with_message(format!("unknown document encoding {other:?} in database"))),
    }
}

fn as_i64(value: u64) -> i64 {
    i64::try_from(value).unwrap_or(i64::MAX)
}

fn as_u64(value: i64) -> u64 {
    u64::try_from(value).unwrap_or(0)
}

impl Storage {
    /// Inserts or updates a document identity. `canonical_path` uniqueness is
    /// enforced by the schema; the command layer deduplicates opens by path
    /// first (R05).
    pub fn upsert_document(&self, record: &DocumentRecord) -> Result<(), AppError> {
        let connection = self.connection();
        connection
            .execute(
                "INSERT INTO documents
                   (doc_id, canonical_path, display_name, format, encoding,
                    content_hash, size_bytes, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(doc_id) DO UPDATE SET
                   canonical_path = excluded.canonical_path,
                   display_name = excluded.display_name,
                   format = excluded.format,
                   encoding = excluded.encoding,
                   content_hash = COALESCE(excluded.content_hash, documents.content_hash),
                   size_bytes = COALESCE(excluded.size_bytes, documents.size_bytes),
                   last_seen_at = excluded.last_seen_at",
                params![
                    record.doc_id,
                    record.canonical_path,
                    record.display_name,
                    format_str(record.format),
                    encoding_str(record.encoding),
                    record.content_hash,
                    record.size_bytes.map(as_i64),
                    record.last_seen_at_ms,
                ],
            )
            .map_err(db_error)?;
        Ok(())
    }

    pub fn get_document(&self, doc_id: &str) -> Result<Option<DocumentRecord>, AppError> {
        let connection = self.connection();
        connection
            .query_row(
                "SELECT doc_id, canonical_path, display_name, format, encoding,
                        content_hash, size_bytes, last_seen_at
                 FROM documents WHERE doc_id = ?1",
                params![doc_id],
                document_from_row,
            )
            .optional()
            .map_err(db_error)
    }

    pub fn find_document_by_path(
        &self,
        canonical_path: &str,
    ) -> Result<Option<DocumentRecord>, AppError> {
        let connection = self.connection();
        connection
            .query_row(
                "SELECT doc_id, canonical_path, display_name, format, encoding,
                        content_hash, size_bytes, last_seen_at
                 FROM documents WHERE canonical_path = ?1",
                params![canonical_path],
                document_from_row,
            )
            .optional()
            .map_err(db_error)
    }
}

type DocumentRow = Result<DocumentRecord, rusqlite::Error>;

fn document_from_row(row: &rusqlite::Row<'_>) -> DocumentRow {
    let format: String = row.get(3)?;
    let encoding: String = row.get(4)?;
    Ok(DocumentRecord {
        doc_id: row.get(0)?,
        canonical_path: row.get(1)?,
        display_name: row.get(2)?,
        format: parse_format(&format).map_err(to_sql_error)?,
        encoding: parse_encoding(&encoding).map_err(to_sql_error)?,
        content_hash: row.get(5)?,
        size_bytes: row.get::<_, Option<i64>>(6)?.map(as_u64),
        last_seen_at_ms: row.get(7)?,
    })
}

fn to_sql_error(error: AppError) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
}

// ---------------------------------------------------------------------------
// Write gate and suppression state (data-model §6; T-13)
// ---------------------------------------------------------------------------

fn suppressed_write() -> SaveResult {
    SaveResult {
        saved: false,
        error: None,
    }
}

fn failed_write(error: &AppError) -> SaveResult {
    SaveResult {
        saved: false,
        error: Some(error.to_payload()),
    }
}

impl Storage {
    /// `write_allowed(category)` from data-model §6. `logs` is not part of
    /// this gate and returns `false` (the diagnostics service owns logs).
    pub fn write_allowed(&self, category: StorageCategory) -> bool {
        match category {
            StorageCategory::Recents | StorageCategory::Positions | StorageCategory::Session => {
                self.remember_records() && !self.is_suppressed(category)
            }
            StorageCategory::Cache | StorageCategory::Authorizations => true,
            StorageCategory::Logs => false,
        }
    }

    /// Process-local suppression flag (data-model §6); only `clear_records`
    /// and privacy actions set it.
    pub fn is_suppressed(&self, category: StorageCategory) -> bool {
        self.gate().contains(category)
    }

    fn suppress(&self, category: StorageCategory) {
        self.gate().insert(category);
    }

    /// `resume_recording` (contract command 21): `None` resumes every
    /// category; explicit categories resume only those listed. Non-suppressible
    /// categories are ignored.
    pub fn resume_recording(&self, categories: Option<&[StorageCategory]>) {
        let mut gate = self.gate();
        match categories {
            None => gate.clear(),
            Some(list) => {
                for category in list {
                    gate.remove(*category);
                }
            }
        }
    }

    /// Explicit document open (`entry != "restore"`) resumes write-back for
    /// the record categories (data-model §6; INV-SR-05/OI-04).
    pub fn resume_after_explicit_open(&self) {
        self.resume_recording(None);
    }
}

// ---------------------------------------------------------------------------
// Recents repository (data-model §3.4, §5; cap 100)
// ---------------------------------------------------------------------------

impl Storage {
    /// Records/updates one recents entry and truncates to
    /// [`RECENTS_LIMIT`] ordered by `opened_at DESC` (R06; SRS §6.1).
    /// Suppressed or failed writes return `SaveResult { saved: false, .. }`
    /// (R27; Inv-AR-06).
    pub fn touch_recent(&self, doc_id: &str, opened_at_ms: i64) -> SaveResult {
        if !self.write_allowed(StorageCategory::Recents) {
            return suppressed_write();
        }
        match self.touch_recent_inner(doc_id, opened_at_ms) {
            Ok(()) => SaveResult {
                saved: true,
                error: None,
            },
            Err(error) => failed_write(&error),
        }
    }

    fn touch_recent_inner(&self, doc_id: &str, opened_at_ms: i64) -> Result<(), AppError> {
        let mut connection = self.connection();
        let transaction = connection.transaction().map_err(db_error)?;
        let last_path: Option<String> = transaction
            .query_row(
                "SELECT canonical_path FROM documents WHERE doc_id = ?1",
                params![doc_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(db_error)?;
        let Some(last_path) = last_path else {
            return Err(AppError::new(ErrorCode::DbFailure)
                .with_message(format!("touch_recent: unknown docId {doc_id}")));
        };
        transaction
            .execute(
                "INSERT INTO recents (doc_id, opened_at, last_path) VALUES (?1, ?2, ?3)
                 ON CONFLICT(doc_id) DO UPDATE SET
                   opened_at = excluded.opened_at, last_path = excluded.last_path",
                params![doc_id, opened_at_ms, last_path],
            )
            .map_err(db_error)?;
        transaction
            .execute(
                "DELETE FROM recents WHERE doc_id NOT IN (
                   SELECT doc_id FROM recents
                   ORDER BY opened_at DESC, doc_id ASC
                   LIMIT ?1)",
                params![RECENTS_LIMIT as i64],
            )
            .map_err(db_error)?;
        transaction.commit().map_err(db_error)
    }

    /// Recent entries, newest first, with a read-time availability recheck
    /// (data-model §3.4). The response path is the document's current
    /// canonical path; `recents.last_path` is refreshed on every touch.
    pub fn list_recents(&self, probe: &dyn PathProbe) -> Result<Vec<RecentEntry>, AppError> {
        let connection = self.connection();
        let mut statement = connection
            .prepare(
                "SELECT r.doc_id, d.display_name, d.canonical_path, r.opened_at
                 FROM recents r JOIN documents d ON d.doc_id = r.doc_id
                 ORDER BY r.opened_at DESC, r.doc_id ASC
                 LIMIT ?1",
            )
            .map_err(db_error)?;
        let rows = statement
            .query_map(params![RECENTS_LIMIT as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })
            .map_err(db_error)?;
        let mut entries = Vec::new();
        for row in rows {
            let (doc_id, display_name, canonical_path, opened_at_ms) = row.map_err(db_error)?;
            let path = Path::new(&canonical_path);
            let available = probe.exists(path) && probe.is_readable(path);
            entries.push(RecentEntry {
                doc_id,
                display_name,
                canonical_path,
                opened_at_ms,
                available,
            });
        }
        Ok(entries)
    }

    pub fn recents_count(&self) -> Result<u64, AppError> {
        self.table_count("recents")
    }
}

// ---------------------------------------------------------------------------
// Positions repository (data-model §3.3)
// ---------------------------------------------------------------------------

impl Storage {
    /// Upserts the reading anchor; the last successful commit wins (data-model
    /// §7). Returns `saved: false` when suppressed, when
    /// `privacy.rememberRecords=false`, or on write failure.
    pub fn save_position(
        &self,
        doc_id: &str,
        anchor: &AnchorRecord,
        updated_at_ms: i64,
    ) -> SaveResult {
        if !self.write_allowed(StorageCategory::Positions) {
            return suppressed_write();
        }
        match self.save_position_inner(doc_id, anchor, updated_at_ms) {
            Ok(()) => SaveResult {
                saved: true,
                error: None,
            },
            Err(error) => failed_write(&error),
        }
    }

    fn save_position_inner(
        &self,
        doc_id: &str,
        anchor: &AnchorRecord,
        updated_at_ms: i64,
    ) -> Result<(), AppError> {
        let heading_path_json = serde_json::to_string(&anchor.heading_path).map_err(json_error)?;
        let source_range_json = serde_json::to_string(&anchor.source_range).map_err(json_error)?;
        let connection = self.connection();
        connection
            .execute(
                "INSERT INTO positions
                   (doc_id, version_hash, heading_path_json, block_fingerprint,
                    offset_ratio, source_range_json, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(doc_id) DO UPDATE SET
                   version_hash = excluded.version_hash,
                   heading_path_json = excluded.heading_path_json,
                   block_fingerprint = excluded.block_fingerprint,
                   offset_ratio = excluded.offset_ratio,
                   source_range_json = excluded.source_range_json,
                   updated_at = excluded.updated_at",
                params![
                    doc_id,
                    anchor.version_hash,
                    heading_path_json,
                    anchor.block_fingerprint,
                    anchor.offset_ratio,
                    source_range_json,
                    updated_at_ms,
                ],
            )
            .map_err(db_error)?;
        Ok(())
    }

    pub fn load_position(&self, doc_id: &str) -> Result<Option<PositionRecord>, AppError> {
        let connection = self.connection();
        let row = connection
            .query_row(
                "SELECT version_hash, heading_path_json, block_fingerprint,
                        offset_ratio, source_range_json, updated_at
                 FROM positions WHERE doc_id = ?1",
                params![doc_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<String>>(2)?,
                        row.get::<_, f64>(3)?,
                        row.get::<_, Option<String>>(4)?,
                        row.get::<_, i64>(5)?,
                    ))
                },
            )
            .optional()
            .map_err(db_error)?;
        let Some((
            version_hash,
            heading_path_json,
            block_fingerprint,
            offset_ratio,
            source_range_json,
            updated_at_ms,
        )) = row
        else {
            return Ok(None);
        };
        let heading_path: Vec<String> =
            serde_json::from_str(&heading_path_json).map_err(|error| {
                AppError::new(ErrorCode::DbFailure)
                    .with_message("positions.heading_path_json is not a JSON string array")
                    .with_source(error)
            })?;
        let source_range = match source_range_json {
            Some(raw) => serde_json::from_str(&raw).map_err(|error| {
                AppError::new(ErrorCode::DbFailure)
                    .with_message("positions.source_range_json is not a valid SourceRange")
                    .with_source(error)
            })?,
            // Defensive default: saves always write a range; a NULL range
            // degrades to "document top" instead of failing the load.
            None => crate::models::SourceRange {
                start_byte: 0,
                end_byte: 0,
            },
        };
        Ok(Some(PositionRecord {
            doc_id: doc_id.to_owned(),
            anchor: AnchorRecord {
                version_hash,
                heading_path,
                block_fingerprint: block_fingerprint.unwrap_or_default(),
                offset_ratio,
                source_range,
            },
            updated_at_ms,
        }))
    }
}

// ---------------------------------------------------------------------------
// Session tabs and sidebar state repository (data-model §3.4, §6)
// ---------------------------------------------------------------------------

impl Storage {
    /// Replaces the stored session (tabs + `session_meta`) in one transaction
    /// (data-model §7). Subject to the session write gate.
    pub fn save_session_tabs(&self, tabs: &[SessionTab], saved_at_ms: i64) -> SaveResult {
        if !self.write_allowed(StorageCategory::Session) {
            return suppressed_write();
        }
        match self.save_session_tabs_inner(tabs, saved_at_ms) {
            Ok(()) => SaveResult {
                saved: true,
                error: None,
            },
            Err(error) => failed_write(&error),
        }
    }

    fn save_session_tabs_inner(
        &self,
        tabs: &[SessionTab],
        saved_at_ms: i64,
    ) -> Result<(), AppError> {
        let active = tabs.iter().filter(|tab| tab.is_active).min_by(|a, b| {
            a.order_index
                .cmp(&b.order_index)
                .then_with(|| a.tab_id.cmp(&b.tab_id))
        });
        let active_tab_id = active.map(|tab| tab.tab_id.clone());
        let mut connection = self.connection();
        let transaction = connection.transaction().map_err(db_error)?;
        transaction
            .execute("DELETE FROM session_tabs", [])
            .map_err(db_error)?;
        transaction
            .execute("DELETE FROM session_meta", [])
            .map_err(db_error)?;
        for tab in tabs {
            transaction
                .execute(
                    "INSERT INTO session_tabs
                       (tab_id, doc_id, order_index, is_active, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        tab.tab_id,
                        tab.doc_id,
                        as_i64(tab.order_index),
                        i64::from(tab.is_active),
                        saved_at_ms,
                    ],
                )
                .map_err(db_error)?;
        }
        let active_json = serde_json::to_string(&active_tab_id).map_err(json_error)?;
        transaction
            .execute(
                "INSERT INTO session_meta (key, value_json) VALUES (?1, ?2)",
                params![META_ACTIVE_TAB_ID, active_json],
            )
            .map_err(db_error)?;
        let saved_json = serde_json::to_string(&saved_at_ms).map_err(json_error)?;
        transaction
            .execute(
                "INSERT INTO session_meta (key, value_json) VALUES (?1, ?2)",
                params![META_SAVED_AT_MS, saved_json],
            )
            .map_err(db_error)?;
        transaction.commit().map_err(db_error)
    }

    /// Stored session snapshot or `None` when nothing was ever saved. The
    /// active tab is recomputed from `session_meta` and must reference an
    /// existing tab (tolerant restore; data-model §7).
    pub fn load_session_snapshot(&self) -> Result<Option<SessionSnapshot>, AppError> {
        let connection = self.connection();
        let mut tabs_statement = connection
            .prepare(
                "SELECT tab_id, doc_id, order_index, is_active
                 FROM session_tabs ORDER BY order_index ASC, tab_id ASC",
            )
            .map_err(db_error)?;
        let rows = tabs_statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            })
            .map_err(db_error)?;
        let mut tabs = Vec::new();
        for row in rows {
            let (tab_id, doc_id, order_index, is_active) = row.map_err(db_error)?;
            tabs.push(SessionTab {
                tab_id,
                doc_id,
                order_index: as_u64(order_index),
                is_active: is_active != 0,
            });
        }
        let mut meta_statement = connection
            .prepare("SELECT key, value_json FROM session_meta")
            .map_err(db_error)?;
        let meta_rows = meta_statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(db_error)?;
        let mut saved_at_ms: Option<i64> = None;
        let mut active_tab_id: Option<String> = None;
        for row in meta_rows {
            let (key, value) = row.map_err(db_error)?;
            match key.as_str() {
                META_SAVED_AT_MS => saved_at_ms = serde_json::from_str(&value).ok(),
                META_ACTIVE_TAB_ID => {
                    active_tab_id = serde_json::from_str::<Option<String>>(&value)
                        .ok()
                        .flatten();
                }
                _ => {}
            }
        }
        if tabs.is_empty() && saved_at_ms.is_none() {
            return Ok(None);
        }
        if let Some(active) = active_tab_id.clone() {
            if !tabs.iter().any(|tab| tab.tab_id == active) {
                active_tab_id = None;
            }
        }
        for tab in &mut tabs {
            tab.is_active = active_tab_id.as_deref() == Some(tab.tab_id.as_str());
        }
        Ok(Some(SessionSnapshot {
            tabs,
            active_tab_id,
            saved_at_ms: saved_at_ms.unwrap_or(0),
        }))
    }

    /// Persists one `sidebar_state` row (expansion/scroll UI state only,
    /// ≤64KiB, data-model §2). Subject to the session write gate because the
    /// session clear category covers `sidebar_state` (data-model §6).
    pub fn save_sidebar_state(
        &self,
        kind: SidebarKind,
        state_key: &str,
        state_json: &str,
        updated_at_ms: i64,
    ) -> SaveResult {
        if !self.write_allowed(StorageCategory::Session) {
            return suppressed_write();
        }
        if state_json.len() > SIDEBAR_STATE_MAX_BYTES {
            return failed_write(&AppError::new(ErrorCode::DbFailure).with_message(format!(
                "sidebar state for {state_key:?} exceeds {SIDEBAR_STATE_MAX_BYTES} bytes"
            )));
        }
        if let Err(error) = serde_json::from_str::<serde_json::Value>(state_json) {
            return failed_write(
                &AppError::new(ErrorCode::DbFailure)
                    .with_message("sidebar state is not valid JSON")
                    .with_source(error),
            );
        }
        match self.save_sidebar_state_inner(kind, state_key, state_json, updated_at_ms) {
            Ok(()) => SaveResult {
                saved: true,
                error: None,
            },
            Err(error) => failed_write(&error),
        }
    }

    fn save_sidebar_state_inner(
        &self,
        kind: SidebarKind,
        state_key: &str,
        state_json: &str,
        updated_at_ms: i64,
    ) -> Result<(), AppError> {
        let connection = self.connection();
        connection
            .execute(
                "INSERT INTO sidebar_state (kind, state_key, state_json, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(kind, state_key) DO UPDATE SET
                   state_json = excluded.state_json,
                   updated_at = excluded.updated_at",
                params![kind.as_str(), state_key, state_json, updated_at_ms],
            )
            .map_err(db_error)?;
        Ok(())
    }

    pub fn load_sidebar_state(
        &self,
        kind: SidebarKind,
        state_key: &str,
    ) -> Result<Option<String>, AppError> {
        let connection = self.connection();
        connection
            .query_row(
                "SELECT state_json FROM sidebar_state WHERE kind = ?1 AND state_key = ?2",
                params![kind.as_str(), state_key],
                |row| row.get(0),
            )
            .optional()
            .map_err(db_error)
    }
}

// ---------------------------------------------------------------------------
// Authorizations repository (data-model §3.2) and the wp-08 persistence hook
// ---------------------------------------------------------------------------

fn grant_kind_str(kind: GrantKind) -> &'static str {
    match kind {
        GrantKind::File => "file",
        GrantKind::Directory => "directory",
        GrantKind::Remote => "remote",
    }
}

fn parse_grant_kind(value: &str) -> Result<GrantKind, AppError> {
    match value {
        "file" => Ok(GrantKind::File),
        "directory" => Ok(GrantKind::Directory),
        "remote" => Ok(GrantKind::Remote),
        other => Err(AppError::new(ErrorCode::DbFailure)
            .with_message(format!("unknown grant kind {other:?} in database"))),
    }
}

fn grant_scope_str(scope: GrantScope) -> &'static str {
    match scope {
        GrantScope::Session => "session",
        GrantScope::Persistent => "persistent",
    }
}

fn parse_grant_scope(value: &str) -> Result<GrantScope, AppError> {
    match value {
        "session" => Ok(GrantScope::Session),
        "persistent" => Ok(GrantScope::Persistent),
        other => Err(AppError::new(ErrorCode::DbFailure)
            .with_message(format!("unknown grant scope {other:?} in database"))),
    }
}

impl Storage {
    /// Upserts one authorization row; `last_confirmed_at` mirrors the grant
    /// time (re-confirmation refreshes both).
    pub fn upsert_grant(&self, record: &GrantRecord) -> Result<(), AppError> {
        let origins_json = match &record.origins {
            Some(origins) => Some(serde_json::to_string(origins).map_err(json_error)?),
            None => None,
        };
        let connection = self.connection();
        connection
            .execute(
                "INSERT INTO authorizations
                   (grant_id, kind, canonical_path, origins_json, scope,
                    source_doc_id, granted_at, last_confirmed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
                 ON CONFLICT(grant_id) DO UPDATE SET
                   kind = excluded.kind,
                   canonical_path = excluded.canonical_path,
                   origins_json = excluded.origins_json,
                   scope = excluded.scope,
                   source_doc_id = excluded.source_doc_id,
                   granted_at = excluded.granted_at,
                   last_confirmed_at = excluded.last_confirmed_at",
                params![
                    record.grant_id,
                    grant_kind_str(record.kind),
                    record.canonical_path,
                    origins_json,
                    grant_scope_str(record.scope),
                    record.doc_id,
                    record.granted_at_ms,
                ],
            )
            .map_err(db_error)?;
        Ok(())
    }

    pub fn delete_grant(&self, grant_id: &str) -> Result<(), AppError> {
        let connection = self.connection();
        connection
            .execute(
                "DELETE FROM authorizations WHERE grant_id = ?1",
                params![grant_id],
            )
            .map_err(db_error)?;
        Ok(())
    }

    /// All stored grants (used by `list_grants` and startup seeding).
    pub fn load_grants(&self) -> Result<Vec<GrantRecord>, AppError> {
        let connection = self.connection();
        let mut statement = connection
            .prepare(
                "SELECT grant_id, kind, canonical_path, origins_json, scope,
                        source_doc_id, granted_at
                 FROM authorizations ORDER BY granted_at ASC, grant_id ASC",
            )
            .map_err(db_error)?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, i64>(6)?,
                ))
            })
            .map_err(db_error)?;
        let mut grants = Vec::new();
        for row in rows {
            let (grant_id, kind, canonical_path, origins_json, scope, doc_id, granted_at_ms) =
                row.map_err(db_error)?;
            let origins = match origins_json {
                Some(raw) => Some(serde_json::from_str::<Vec<String>>(&raw).map_err(|error| {
                    AppError::new(ErrorCode::DbFailure)
                        .with_message("authorizations.origins_json is not a JSON string array")
                        .with_source(error)
                })?),
                None => None,
            };
            grants.push(GrantRecord {
                grant_id,
                kind: parse_grant_kind(&kind)?,
                scope: parse_grant_scope(&scope)?,
                canonical_path,
                origins,
                doc_id,
                granted_at_ms,
            });
        }
        Ok(grants)
    }

    /// Startup step from data-model §3.2: session rows are removed, persistent
    /// rows are kept for revalidation.
    pub fn purge_session_grants(&self) -> Result<u64, AppError> {
        let connection = self.connection();
        connection
            .execute("DELETE FROM authorizations WHERE scope = 'session'", [])
            .map(|count| count as u64)
            .map_err(db_error)
    }

    pub fn grants_count(&self) -> Result<u64, AppError> {
        self.table_count("authorizations")
    }
}

impl GrantPersistence for Storage {
    fn load_all(&self) -> Result<Vec<GrantRecord>, AppError> {
        self.load_grants()
    }

    fn upsert(&self, record: &GrantRecord) -> Result<(), AppError> {
        self.upsert_grant(record)
    }

    fn delete(&self, grant_id: &str) -> Result<(), AppError> {
        self.delete_grant(grant_id)
    }
}

// ---------------------------------------------------------------------------
// Cache metadata repository and LRU (data-model §2, §6, §7)
// ---------------------------------------------------------------------------

/// Resolves a `cache_meta.rel_path` inside `cache_dir`. Relative paths with
/// `..`, absolute paths or empty paths are rejected so a corrupt row can never
/// make the service delete a file outside the cache directory (data-model §2).
pub fn resolve_cache_path(cache_dir: &Path, rel_path: &str) -> Option<PathBuf> {
    if rel_path.is_empty() {
        return None;
    }
    let relative = Path::new(rel_path);
    if relative.is_absolute() {
        return None;
    }
    if !relative
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
    {
        return None;
    }
    Some(cache_dir.join(relative))
}

impl Storage {
    pub fn upsert_cache_entry(&self, entry: &CacheEntry) -> Result<(), AppError> {
        let connection = self.connection();
        connection
            .execute(
                "INSERT INTO cache_meta
                   (cache_key, kind, rel_path, size_bytes, source_url_hash,
                    created_at, last_access_at)
                 VALUES (?1, 'remote-image', ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(cache_key) DO UPDATE SET
                   rel_path = excluded.rel_path,
                   size_bytes = excluded.size_bytes,
                   source_url_hash = excluded.source_url_hash,
                   last_access_at = excluded.last_access_at",
                params![
                    entry.cache_key,
                    entry.rel_path,
                    as_i64(entry.size_bytes),
                    entry.source_url_hash,
                    entry.created_at_ms,
                    entry.last_access_at_ms,
                ],
            )
            .map_err(db_error)?;
        Ok(())
    }

    pub fn touch_cache_entry(
        &self,
        cache_key: &str,
        last_access_at_ms: i64,
    ) -> Result<u64, AppError> {
        let connection = self.connection();
        connection
            .execute(
                "UPDATE cache_meta SET last_access_at = ?1 WHERE cache_key = ?2",
                params![last_access_at_ms, cache_key],
            )
            .map(|count| count as u64)
            .map_err(db_error)
    }

    pub fn cache_entry(&self, cache_key: &str) -> Result<Option<CacheEntry>, AppError> {
        let connection = self.connection();
        connection
            .query_row(
                "SELECT cache_key, rel_path, size_bytes, source_url_hash,
                        created_at, last_access_at
                 FROM cache_meta WHERE cache_key = ?1",
                params![cache_key],
                cache_entry_from_row,
            )
            .optional()
            .map_err(db_error)
    }

    /// All cache rows in LRU order (oldest `last_access_at` first).
    pub fn cache_entries(&self) -> Result<Vec<CacheEntry>, AppError> {
        let connection = self.connection();
        let mut statement = connection
            .prepare(
                "SELECT cache_key, rel_path, size_bytes, source_url_hash,
                        created_at, last_access_at
                 FROM cache_meta
                 ORDER BY last_access_at ASC, created_at ASC, cache_key ASC",
            )
            .map_err(db_error)?;
        let rows = statement
            .query_map([], cache_entry_from_row)
            .map_err(db_error)?;
        let mut entries = Vec::new();
        for row in rows {
            entries.push(row.map_err(db_error)?);
        }
        Ok(entries)
    }

    /// Total size of the cache index, used by the LRU enforcement (data-model
    /// §7) and the storage overview.
    pub fn cache_total_bytes(&self) -> Result<u64, AppError> {
        let connection = self.connection();
        connection
            .query_row(
                "SELECT COALESCE(SUM(size_bytes), 0) FROM cache_meta",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(as_u64)
            .map_err(db_error)
    }

    pub fn cache_count(&self) -> Result<u64, AppError> {
        self.table_count("cache_meta")
    }

    /// Evicts least-recently-used cache entries until the index reports at
    /// most `max_bytes`, deleting the backing files (data-model §7). A file
    /// deletion failure keeps the row for the next pass; the file is never
    /// resolved outside `cache_dir`.
    pub fn enforce_cache_limit(
        &self,
        cache_dir: &Path,
        max_bytes: u64,
    ) -> Result<CacheEvictionReport, AppError> {
        let entries = self.cache_entries()?;
        let mut report = CacheEvictionReport::default();
        let mut total: u64 = entries.iter().map(|entry| entry.size_bytes).sum();
        if total <= max_bytes {
            return Ok(report);
        }
        for entry in &entries {
            if total <= max_bytes {
                break;
            }
            match resolve_cache_path(cache_dir, &entry.rel_path) {
                None => {
                    if self.delete_cache_row(&entry.cache_key)? {
                        report.evicted += 1;
                        report.unsafe_paths += 1;
                        total = total.saturating_sub(entry.size_bytes);
                    }
                }
                Some(path) => {
                    let deleted = match fs::remove_file(&path) {
                        Ok(()) => true,
                        Err(error) if error.kind() == std::io::ErrorKind::NotFound => true,
                        Err(_) => false,
                    };
                    if deleted {
                        if self.delete_cache_row(&entry.cache_key)? {
                            report.evicted += 1;
                            report.freed_bytes += entry.size_bytes;
                            total = total.saturating_sub(entry.size_bytes);
                        }
                    } else {
                        report.failures += 1;
                    }
                }
            }
        }
        Ok(report)
    }

    /// Removes one cache entry (metadata + file), e.g. on remote revoke
    /// (data-model §3.2). Returns `false` when the key is unknown.
    pub fn remove_cache_entry(&self, cache_key: &str, cache_dir: &Path) -> Result<bool, AppError> {
        let Some(entry) = self.cache_entry(cache_key)? else {
            return Ok(false);
        };
        if let Some(path) = resolve_cache_path(cache_dir, &entry.rel_path) {
            match fs::remove_file(&path) {
                Ok(()) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    // Keep the row so the next LRU pass can retry (data-model §7).
                    return Err(AppError::from_io_write(error));
                }
            }
        }
        self.delete_cache_row(cache_key)?;
        Ok(true)
    }

    fn delete_cache_row(&self, cache_key: &str) -> Result<bool, AppError> {
        let mut connection = self.connection();
        let transaction = connection.transaction().map_err(db_error)?;
        let changed = transaction
            .execute(
                "DELETE FROM cache_meta WHERE cache_key = ?1",
                params![cache_key],
            )
            .map_err(db_error)?;
        transaction.commit().map_err(db_error)?;
        Ok(changed > 0)
    }
}

type CacheRow = Result<CacheEntry, rusqlite::Error>;

fn cache_entry_from_row(row: &rusqlite::Row<'_>) -> CacheRow {
    Ok(CacheEntry {
        cache_key: row.get(0)?,
        rel_path: row.get(1)?,
        size_bytes: as_u64(row.get::<_, i64>(2)?),
        source_url_hash: row.get(3)?,
        created_at_ms: row.get(4)?,
        last_access_at_ms: row.get(5)?,
    })
}

// ---------------------------------------------------------------------------
// Categorized clearing (data-model §6; T-13) and the storage overview
// ---------------------------------------------------------------------------

impl Storage {
    /// `clear_records` core (contract command 20). Requires `confirm=true`;
    /// without confirmation every category reports zero changes and nothing is
    /// touched (INV-WB-05). Each category reports its own outcome and error
    /// (INV-WB-06); successful record clears set the session write
    /// suppression until `resume_recording`/explicit open (R27). Only app
    /// data is touched — never user source files (INV-WB-08).
    pub fn clear_records(
        &self,
        categories: &[StorageCategory],
        confirm: bool,
        cache_dir: &Path,
    ) -> Vec<ClearResult> {
        categories
            .iter()
            .map(|category| {
                if !confirm {
                    return ClearResult {
                        category: *category,
                        cleared: 0,
                        error: None,
                    };
                }
                self.clear_one(*category, cache_dir)
            })
            .collect()
    }

    fn clear_one(&self, category: StorageCategory, cache_dir: &Path) -> ClearResult {
        match category {
            StorageCategory::Recents => self.clear_simple(category, "DELETE FROM recents", true),
            StorageCategory::Positions => {
                self.clear_simple(category, "DELETE FROM positions", true)
            }
            StorageCategory::Session => self.clear_session_category(),
            StorageCategory::Cache => self.clear_cache_category(cache_dir),
            StorageCategory::Authorizations => {
                self.clear_simple(category, "DELETE FROM authorizations", false)
            }
            // The logs category is owned by `services/diagnostics` (wp-14);
            // the storage layer has nothing to remove for it.
            StorageCategory::Logs => ClearResult {
                category,
                cleared: 0,
                error: None,
            },
        }
    }

    fn clear_simple(&self, category: StorageCategory, sql: &str, suppress: bool) -> ClearResult {
        let mut connection = self.connection();
        let result = (|| -> Result<u64, AppError> {
            let transaction = connection.transaction().map_err(db_error)?;
            let cleared = transaction.execute(sql, []).map_err(db_error)? as u64;
            transaction.commit().map_err(db_error)?;
            Ok(cleared)
        })();
        self.clear_outcome(category, result, suppress)
    }

    fn clear_session_category(&self) -> ClearResult {
        let mut connection = self.connection();
        let result = (|| -> Result<u64, AppError> {
            let transaction = connection.transaction().map_err(db_error)?;
            let tabs = transaction
                .execute("DELETE FROM session_tabs", [])
                .map_err(db_error)? as u64;
            let meta = transaction
                .execute("DELETE FROM session_meta", [])
                .map_err(db_error)? as u64;
            let sidebar = transaction
                .execute("DELETE FROM sidebar_state", [])
                .map_err(db_error)? as u64;
            transaction.commit().map_err(db_error)?;
            Ok(tabs + meta + sidebar)
        })();
        self.clear_outcome(StorageCategory::Session, result, true)
    }

    fn clear_cache_category(&self, cache_dir: &Path) -> ClearResult {
        let category = StorageCategory::Cache;
        let entries = match self.cache_entries() {
            Ok(entries) => entries,
            Err(error) => {
                return ClearResult {
                    category,
                    cleared: 0,
                    error: Some(error.to_payload()),
                }
            }
        };
        let mut removable = Vec::new();
        let mut failure_count: u64 = 0;
        let mut first_failure: Option<std::io::Error> = None;
        for entry in &entries {
            match resolve_cache_path(cache_dir, &entry.rel_path) {
                None => removable.push(entry.cache_key.clone()),
                Some(path) => match fs::remove_file(&path) {
                    Ok(()) => removable.push(entry.cache_key.clone()),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                        removable.push(entry.cache_key.clone())
                    }
                    Err(error) => {
                        failure_count += 1;
                        if first_failure.is_none() {
                            first_failure = Some(error);
                        }
                    }
                },
            }
        }
        let cleared = if removable.is_empty() {
            0
        } else {
            match self.delete_cache_rows(&removable) {
                Ok(count) => count,
                Err(error) => {
                    return ClearResult {
                        category,
                        cleared: 0,
                        error: Some(error.to_payload()),
                    }
                }
            }
        };
        let error = first_failure.map(|io_error| {
            AppError::new(ErrorCode::IoWriteFailed)
                .with_message(format!(
                    "{failure_count} cache files could not be deleted; their entries were kept"
                ))
                .with_source(io_error)
                .to_payload()
        });
        ClearResult {
            category,
            cleared,
            error,
        }
    }

    fn delete_cache_rows(&self, cache_keys: &[String]) -> Result<u64, AppError> {
        let mut connection = self.connection();
        let transaction = connection.transaction().map_err(db_error)?;
        let mut cleared: u64 = 0;
        for cache_key in cache_keys {
            cleared += transaction
                .execute(
                    "DELETE FROM cache_meta WHERE cache_key = ?1",
                    params![cache_key],
                )
                .map_err(db_error)? as u64;
        }
        transaction.commit().map_err(db_error)?;
        Ok(cleared)
    }

    fn clear_outcome(
        &self,
        category: StorageCategory,
        result: Result<u64, AppError>,
        suppress: bool,
    ) -> ClearResult {
        match result {
            Ok(cleared) => {
                if suppress {
                    self.suppress(category);
                }
                ClearResult {
                    category,
                    cleared,
                    error: None,
                }
            }
            Err(error) => ClearResult {
                category,
                cleared: 0,
                error: Some(error.to_payload()),
            },
        }
    }

    /// Per-category usage for `get_storage_overview` (contract command 19).
    /// `logs` is reported as zero here; the diagnostics service (wp-14) owns
    /// log-file counts and the command layer merges them.
    pub fn storage_overview(&self, cache_dir: &Path) -> Result<StorageOverview, AppError> {
        let session_count = self.table_count("session_tabs")?
            + self.table_count("session_meta")?
            + self.table_count("sidebar_state")?;
        let categories = vec![
            StorageCategoryInfo {
                category: StorageCategory::Recents,
                count: self.recents_count()?,
                bytes: None,
            },
            StorageCategoryInfo {
                category: StorageCategory::Positions,
                count: self.table_count("positions")?,
                bytes: None,
            },
            StorageCategoryInfo {
                category: StorageCategory::Session,
                count: session_count,
                bytes: None,
            },
            StorageCategoryInfo {
                category: StorageCategory::Cache,
                count: self.cache_count()?,
                bytes: Some(self.cache_total_bytes()?),
            },
            StorageCategoryInfo {
                category: StorageCategory::Authorizations,
                count: self.grants_count()?,
                bytes: None,
            },
            StorageCategoryInfo {
                category: StorageCategory::Logs,
                count: 0,
                bytes: None,
            },
        ];
        Ok(StorageOverview {
            categories,
            database_path: self.inner.path.display().to_string(),
            cache_dir: cache_dir.display().to_string(),
        })
    }

    fn table_count(&self, table: &str) -> Result<u64, AppError> {
        let connection = self.connection();
        connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get::<_, i64>(0)
            })
            .map(as_u64)
            .map_err(db_error)
    }
}

// ---------------------------------------------------------------------------
// Unit tests for pure helpers
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FrozenLimits;

    #[test]
    fn cache_path_resolution_guards_against_traversal() {
        let cache_dir = Path::new("/app/cache");
        assert_eq!(
            resolve_cache_path(cache_dir, "remote-images/a.png"),
            Some(PathBuf::from("/app/cache/remote-images/a.png"))
        );
        assert_eq!(resolve_cache_path(cache_dir, "../escape.png"), None);
        assert_eq!(resolve_cache_path(cache_dir, "a/../../escape.png"), None);
        assert_eq!(resolve_cache_path(cache_dir, "/etc/passwd"), None);
        assert_eq!(resolve_cache_path(cache_dir, ""), None);
        assert_eq!(resolve_cache_path(cache_dir, "./a.png"), None);
    }

    #[test]
    fn settings_parsing_clamps_corrupt_and_out_of_range_values() {
        let mut map = BTreeMap::new();
        map.insert(SETTING_FONT_SIZE_PX.to_owned(), "99".to_owned());
        map.insert(SETTING_LINE_HEIGHT.to_owned(), "not json".to_owned());
        map.insert(SETTING_THEME.to_owned(), "\"dark\"".to_owned());
        let settings = settings_from_map(&map);
        assert_eq!(settings.font_size_px, 17);
        assert_eq!(settings.line_height, 1.8);
        assert_eq!(settings.theme, Theme::Dark);
        assert_eq!(settings.max_content_width_px, 760);
    }

    #[test]
    fn frozen_limits_match_storage_constants() {
        let limits = FrozenLimits::default();
        assert_eq!(limits.recent_limit, RECENTS_LIMIT as u64);
        assert_eq!(limits.cache_max_bytes, CACHE_MAX_BYTES);
    }
}
