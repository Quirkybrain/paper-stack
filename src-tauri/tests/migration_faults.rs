//! Migration and open failure-injection matrix (T-12/T-14; NF08; data-model
//! §4): empty database, existing v1 database, corrupted bytes, read-only
//! directory, disk full (bounded pages) and interrupted migration rollback.

use std::fs;
use std::path::PathBuf;

use paperstack_lib::error::{AppError, ErrorCode};
use paperstack_lib::models::{
    AnchorRecord, GlobalSettings, GlobalSettingsPatch, GrantKind, GrantRecord, GrantScope,
    SourceRange,
};
use paperstack_lib::services::storage::{
    default_migrations, migrate_connection, CacheEntry, Migration, Storage, DATABASE_FILE_NAME,
    SCHEMA_REVISION,
};
use rusqlite::{Connection, Transaction};
use tempfile::TempDir;

const EXPECTED_TABLES: [&str; 9] = [
    "authorizations",
    "cache_meta",
    "documents",
    "positions",
    "recents",
    "session_meta",
    "session_tabs",
    "settings",
    "sidebar_state",
];

const EXPECTED_INDEXES: [&str; 5] = [
    "idx_auth_scope",
    "idx_cache_last_access",
    "idx_positions_updated",
    "idx_recents_opened",
    "idx_session_tabs_order",
];

fn open_fixture() -> (TempDir, Storage) {
    let temp = TempDir::new().unwrap();
    let storage = Storage::open(temp.path()).unwrap();
    (temp, storage)
}

fn anchor() -> AnchorRecord {
    AnchorRecord {
        version_hash: "a".repeat(64),
        heading_path: vec!["1".to_owned()],
        block_fingerprint: "fp1:0123456789abcdef".to_owned(),
        offset_ratio: 0.5,
        source_range: SourceRange {
            start_byte: 4,
            end_byte: 8,
        },
    }
}

fn scalar_i64(connection: &Connection, sql: &str) -> i64 {
    connection.query_row(sql, [], |row| row.get(0)).unwrap()
}

#[test]
fn empty_database_is_migrated_to_schema_v1_with_wal_and_strict_tables() {
    let (temp, storage) = open_fixture();
    assert_eq!(storage.schema_revision().unwrap(), SCHEMA_REVISION);
    let db_path: PathBuf = storage.database_path().to_path_buf();
    assert_eq!(db_path, temp.path().join(DATABASE_FILE_NAME));
    drop(storage);

    let connection = Connection::open(&db_path).unwrap();
    let mut statement = connection
        .prepare(
            "SELECT name FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .unwrap();
    let tables: Vec<String> = statement
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(tables, EXPECTED_TABLES);

    let mut statement = connection
        .prepare(
            "SELECT name FROM sqlite_master
             WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .unwrap();
    let indexes: Vec<String> = statement
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(indexes, EXPECTED_INDEXES);

    // Every table is STRICT and the journal mode is WAL (data-model §2).
    for table in EXPECTED_TABLES {
        let sql: String = connection
            .query_row(
                "SELECT sql FROM sqlite_master WHERE name = ?1",
                [table],
                |row| row.get(0),
            )
            .unwrap();
        assert!(sql.contains("STRICT"), "table {table} is not STRICT: {sql}");
    }
    let journal_mode: String = connection
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .unwrap();
    assert_eq!(journal_mode.to_lowercase(), "wal");
}

#[test]
fn v1_database_reopens_idempotently_and_preserves_settings() {
    let temp = TempDir::new().unwrap();
    {
        let storage = Storage::open(temp.path()).unwrap();
        let patch = GlobalSettingsPatch {
            font_size_px: Some(20),
            ..Default::default()
        };
        let updated = storage.update_settings(&patch, 1_000).unwrap();
        assert_eq!(updated.font_size_px, 20);
        assert_eq!(storage.settings_revision(), 1);
    }
    {
        let storage = Storage::open(temp.path()).unwrap();
        assert_eq!(storage.schema_revision().unwrap(), SCHEMA_REVISION);
        assert_eq!(storage.load_settings().unwrap().font_size_px, 20);
    }
    // Running the migration again on a current database is a no-op.
    let mut connection = Connection::open(temp.path().join(DATABASE_FILE_NAME)).unwrap();
    assert_eq!(
        migrate_connection(&mut connection, default_migrations()).unwrap(),
        SCHEMA_REVISION
    );
    assert_eq!(
        migrate_connection(&mut connection, default_migrations()).unwrap(),
        SCHEMA_REVISION
    );
}

#[test]
fn newer_schema_revision_is_refused_read_write_and_readable_in_read_only_degrade() {
    let temp = TempDir::new().unwrap();
    let db_path = temp.path().join(DATABASE_FILE_NAME);
    {
        let storage = Storage::open_path(&db_path).unwrap();
        // A persistent grant proves records stay readable in the degrade.
        storage
            .upsert_grant(&GrantRecord {
                grant_id: "g-read-only-degrade".to_owned(),
                kind: GrantKind::File,
                scope: GrantScope::Persistent,
                canonical_path: Some("/tmp/paperstack-read-only-degrade.md".to_owned()),
                origins: None,
                doc_id: None,
                granted_at_ms: 1,
            })
            .unwrap();
    }
    {
        let connection = Connection::open(&db_path).unwrap();
        connection.pragma_update(None, "user_version", 2).unwrap();
    }
    let error = Storage::open_path(&db_path).unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbMigration);

    let storage = Storage::open_read_only_path(&db_path).unwrap();
    assert!(storage.is_read_only());
    assert_eq!(storage.schema_revision().unwrap(), 2);
    assert_eq!(storage.load_settings().unwrap(), GlobalSettings::default());
    let save = storage.save_position("d-missing", &anchor(), 5);
    assert!(!save.saved);
    assert_eq!(
        save.error.as_ref().map(|error| error.code.as_str()),
        Some("PS_DB_FAILURE")
    );
    drop(storage);

    // The NF08 startup ladder (`AppState::create`; A-05) reaches the same
    // read-only degrade and reports the read-write failure honestly.
    let (degraded, read_write_error) = Storage::open_with_degrade(temp.path());
    assert_eq!(
        read_write_error.as_ref().map(AppError::code),
        Some(ErrorCode::DbMigration)
    );
    let degraded = degraded.expect("read-only degrade must be reachable");
    assert!(degraded.is_read_only());
    assert_eq!(degraded.schema_revision().unwrap(), 2);
    assert_eq!(degraded.load_settings().unwrap(), GlobalSettings::default());
    let grants = degraded.load_grants().unwrap();
    assert_eq!(grants.len(), 1);
    assert_eq!(grants[0].grant_id, "g-read-only-degrade");
    drop(degraded);

    // The file is preserved and not downgraded (data-model §4.5).
    let connection = Connection::open(&db_path).unwrap();
    assert_eq!(scalar_i64(&connection, "PRAGMA user_version"), 2);
}

#[test]
fn storage_open_degrade_ladder_prefers_read_write_and_reports_corruption() {
    // A healthy directory opens read-write with no degrade status.
    let temp = TempDir::new().unwrap();
    let (storage, error) = Storage::open_with_degrade(temp.path());
    let storage = storage.expect("a fresh database must open");
    assert!(!storage.is_read_only());
    assert!(error.is_none());

    // A corrupt file is not silently degraded or wiped: no storage handle and
    // the PS_DB_MIGRATION error is preserved (NF08; data-model §4.4).
    let bad = TempDir::new().unwrap();
    let bad_path = bad.path().join(DATABASE_FILE_NAME);
    let garbage = b"\x00\x01not a sqlite database at all\xff\xfe";
    fs::write(&bad_path, garbage).unwrap();
    let (storage, error) = Storage::open_with_degrade(bad.path());
    assert!(storage.is_none());
    assert_eq!(
        error.map(|error| error.code()),
        Some(ErrorCode::DbMigration)
    );
    assert_eq!(fs::read(&bad_path).unwrap(), garbage);
}

#[test]
fn corrupted_database_is_reported_and_original_bytes_are_preserved() {
    let temp = TempDir::new().unwrap();
    let db_path = temp.path().join(DATABASE_FILE_NAME);
    let garbage = b"\x00\x01not a sqlite database at all\xff\xfe";
    fs::write(&db_path, garbage).unwrap();
    let error = Storage::open_path(&db_path).unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbMigration);
    assert_eq!(fs::read(&db_path).unwrap(), garbage);
    assert!(db_path.exists());
}

#[test]
fn interrupted_migration_rolls_back_the_failing_step() {
    fn apply_a(transaction: &Transaction<'_>) -> rusqlite::Result<()> {
        transaction.execute_batch("CREATE TABLE a (x INTEGER) STRICT;")
    }
    fn apply_b(transaction: &Transaction<'_>) -> rusqlite::Result<()> {
        // Partial DDL succeeds, then the step is interrupted before commit.
        transaction.execute_batch("CREATE TABLE b (x INTEGER) STRICT;")?;
        Err(rusqlite::Error::InvalidQuery)
    }
    let temp = TempDir::new().unwrap();
    let mut connection = Connection::open(temp.path().join("interrupted.sqlite3")).unwrap();
    let migrations = [
        Migration {
            version: 1,
            name: "a",
            apply: apply_a,
        },
        Migration {
            version: 2,
            name: "b",
            apply: apply_b,
        },
    ];
    let error = migrate_connection(&mut connection, &migrations).unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbMigration);
    // Step 1 committed; step 2 rolled back entirely (including its DDL).
    assert_eq!(scalar_i64(&connection, "PRAGMA user_version"), 1);
    assert_eq!(
        scalar_i64(
            &connection,
            "SELECT COUNT(*) FROM sqlite_master WHERE name = 'a'"
        ),
        1
    );
    assert_eq!(
        scalar_i64(
            &connection,
            "SELECT COUNT(*) FROM sqlite_master WHERE name = 'b'"
        ),
        0
    );
}

#[test]
fn disk_full_during_migration_rolls_back_and_keeps_revision_zero() {
    let temp = TempDir::new().unwrap();
    let db_path = temp.path().join("full.sqlite3");
    let mut connection = Connection::open(&db_path).unwrap();
    // One page of database is the whole budget: every new table needs a page.
    connection
        .pragma_update(None, "max_page_count", 1u32)
        .unwrap();
    let error = migrate_connection(&mut connection, default_migrations()).unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbMigration);
    assert_eq!(scalar_i64(&connection, "PRAGMA user_version"), 0);
    assert_eq!(
        scalar_i64(
            &connection,
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        ),
        0
    );
    assert!(db_path.exists());
}

#[test]
fn disk_full_during_record_write_reports_db_failure_and_keeps_database_usable() {
    let (_temp, storage) = open_fixture();
    // Pin the page budget to the current database size so growth fails with
    // SQLITE_FULL while the connection stays healthy.
    storage.set_max_page_count(1).unwrap();
    let entry = CacheEntry {
        cache_key: "c-full".to_owned(),
        rel_path: "x".repeat(256 * 1024),
        size_bytes: 1,
        source_url_hash: None,
        created_at_ms: 1,
        last_access_at_ms: 1,
    };
    let error = storage.upsert_cache_entry(&entry).unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbFailure);
    assert_eq!(storage.cache_count().unwrap(), 0);
    assert_eq!(storage.load_settings().unwrap(), GlobalSettings::default());
}

#[test]
fn missing_database_file_is_created_in_the_app_data_directory() {
    let temp = TempDir::new().unwrap();
    let app_dir = temp.path().join("appdata");
    let storage = Storage::open(&app_dir).unwrap();
    assert!(app_dir.join(DATABASE_FILE_NAME).is_file());
    assert_eq!(storage.schema_revision().unwrap(), SCHEMA_REVISION);
}

#[cfg(unix)]
#[test]
fn read_only_directory_fails_cleanly_and_preserves_the_database() {
    use std::os::unix::fs::PermissionsExt;

    let temp = TempDir::new().unwrap();
    let app_dir = temp.path().join("appdata");
    let db_path = app_dir.join(DATABASE_FILE_NAME);
    {
        // Create a clean v1 database; a clean close removes -wal/-shm again.
        let _storage = Storage::open(&app_dir).unwrap();
    }
    let before = fs::read(&db_path).unwrap();

    fs::set_permissions(&app_dir, fs::Permissions::from_mode(0o555)).unwrap();
    // Running as root: permission bits do not restrict writes; skip.
    let writable = fs::File::create(app_dir.join("probe")).is_ok();
    let result = Storage::open(&app_dir);
    fs::set_permissions(&app_dir, fs::Permissions::from_mode(0o755)).unwrap();
    if writable {
        fs::remove_file(app_dir.join("probe")).unwrap();
        return;
    }
    let error = result.unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbMigration);
    assert_eq!(fs::read(&db_path).unwrap(), before);
}

#[test]
fn read_only_open_rejects_a_corrupted_file_instead_of_degrading_silently() {
    let temp = TempDir::new().unwrap();
    let db_path = temp.path().join(DATABASE_FILE_NAME);
    fs::write(&db_path, b"still not a database").unwrap();
    let error = Storage::open_read_only_path(&db_path).unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbMigration);
}

#[test]
fn database_paths_are_outside_user_source_directories() {
    // The service only writes where the caller points it; the app-data fixture
    // and a separate source fixture prove no file lands in the source tree.
    let temp = TempDir::new().unwrap();
    let source_dir = temp.path().join("source");
    let app_dir = temp.path().join("appdata");
    fs::create_dir_all(&source_dir).unwrap();
    let source_file = source_dir.join("document.md");
    fs::write(&source_file, "# source\n").unwrap();
    let storage = Storage::open(&app_dir).unwrap();
    assert_eq!(fs::read(&source_file).unwrap(), b"# source\n");
    assert_eq!(fs::read_dir(&source_dir).unwrap().count(), 1);
    assert!(storage.database_path().starts_with(&app_dir));
}
