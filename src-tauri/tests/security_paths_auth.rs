//! Security vectors for `services/paths.rs` and `services/auth.rs`
//! (security-model §2–§4; data-model §3.2; ADR-005): tempfile-based path
//! authorization vectors plus registry grant/revoke/revalidation behavior.

use std::cell::RefCell;
use std::collections::VecDeque;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::{DetailValue, GrantKind, GrantRecord, GrantScope};
use paperstack_lib::services::auth::{AuthRegistry, GrantPersistence};
use paperstack_lib::services::paths::{self, LocalReadOutcome, PathProbe, SystemPathProbe};
use tempfile::TempDir;

fn write_file(path: &Path, contents: &str) {
    std::fs::write(path, contents).unwrap();
}

fn canonical(path: &Path) -> PathBuf {
    std::fs::canonicalize(path).unwrap()
}

struct Fixture {
    _tmp: TempDir,
    root: PathBuf,
    sub: PathBuf,
    outside: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let tmp = tempfile::tempdir().unwrap();
        let root = tmp.path().join("docs");
        let sub = root.join("sub");
        let outside = tmp.path().join("outside");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::create_dir_all(&outside).unwrap();
        std::fs::create_dir_all(root.join("Sub")).unwrap();
        write_file(&root.join("a.md"), "# a\n");
        write_file(&sub.join("b.md"), "# b\n");
        write_file(&root.join("Sub").join("c.md"), "# c\n");
        write_file(&outside.join("secret.md"), "# secret\n");
        std::os::unix::fs::symlink(&outside, root.join("link-outside")).unwrap();
        std::os::unix::fs::symlink(&sub, root.join("link-inside")).unwrap();
        Self {
            _tmp: tmp,
            root,
            sub,
            outside,
        }
    }

    fn root(&self) -> PathBuf {
        canonical(&self.root)
    }

    fn sub(&self) -> PathBuf {
        canonical(&self.sub)
    }
}

fn directory_grant(path: &Path, scope: GrantScope) -> GrantRecord {
    GrantRecord {
        grant_id: format!("g-dir-{}", path.display()),
        kind: GrantKind::Directory,
        scope,
        canonical_path: Some(path.to_string_lossy().into_owned()),
        origins: None,
        doc_id: None,
        granted_at_ms: 0,
    }
}

fn file_grant(path: &Path) -> GrantRecord {
    GrantRecord {
        grant_id: format!("g-file-{}", path.display()),
        kind: GrantKind::File,
        scope: GrantScope::Persistent,
        canonical_path: Some(path.to_string_lossy().into_owned()),
        origins: None,
        doc_id: None,
        granted_at_ms: 0,
    }
}

fn root_candidate(error: &paperstack_lib::error::AppError) -> String {
    match error
        .details()
        .and_then(|details| details.get("rootCandidate"))
    {
        Some(DetailValue::String(value)) => value.clone(),
        other => panic!("expected a rootCandidate detail, got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// paths.rs — security-model §2.2 mandatory order
// ---------------------------------------------------------------------------

#[test]
fn inside_root_parent_traversal_is_allowed() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let outcome = paths::authorize_local_read(&probe, &fixture.sub(), "../a.md", &grants).unwrap();
    match outcome {
        LocalReadOutcome::Authorized(read) => {
            assert_eq!(read.canonical_path, canonical(&fixture.root.join("a.md")));
            assert_eq!(read.grant_id, grants[0].grant_id);
        }
        other => panic!("expected authorization, got {other:?}"),
    }
}

#[test]
fn outside_root_is_denied_with_root_candidate() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let error =
        paths::authorize_local_read(&probe, &fixture.sub(), "../../outside/secret.md", &grants)
            .unwrap_err();
    assert_eq!(error.code(), ErrorCode::AuthOutsideRoot);
    assert_eq!(
        root_candidate(&error),
        canonical(&fixture.outside).to_string_lossy().into_owned()
    );
}

#[test]
fn symlink_escape_is_denied() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let error =
        paths::authorize_local_read(&probe, &fixture.root(), "link-outside/secret.md", &grants)
            .unwrap_err();
    assert_eq!(error.code(), ErrorCode::AuthOutsideRoot);
}

#[test]
fn symlink_inside_root_is_allowed_with_resolved_target() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let outcome =
        paths::authorize_local_read(&probe, &fixture.root(), "link-inside/b.md", &grants).unwrap();
    match outcome {
        LocalReadOutcome::Authorized(read) => {
            assert_eq!(read.canonical_path, canonical(&fixture.sub.join("b.md")));
        }
        other => panic!("expected authorization, got {other:?}"),
    }
}

#[test]
fn empty_and_nul_references_are_not_found() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    for raw in ["", "a\0b.md", "%00.md"] {
        let error = paths::authorize_local_read(&probe, &fixture.root(), raw, &grants).unwrap_err();
        assert_eq!(error.code(), ErrorCode::IoNotFound, "raw ref {raw:?}");
    }
}

#[test]
fn scheme_handling_routes_or_rejects() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    match paths::authorize_local_read(
        &probe,
        &fixture.root(),
        "https://img.example/a.png",
        &grants,
    )
    .unwrap()
    {
        LocalReadOutcome::Remote { raw_ref } => {
            assert_eq!(raw_ref, "https://img.example/a.png");
        }
        other => panic!("expected remote routing, got {other:?}"),
    }
    match paths::authorize_local_read(&probe, &fixture.root(), "http://img.example/a.png", &grants)
        .unwrap()
    {
        LocalReadOutcome::Remote { .. } => {}
        other => panic!("expected remote routing, got {other:?}"),
    }

    for raw in [
        "javascript:alert(1)",
        "data:text/plain,hi",
        "file:///etc/passwd",
        "vscode://file/tmp/a.md",
    ] {
        let error = paths::authorize_local_read(&probe, &fixture.root(), raw, &grants).unwrap_err();
        assert_eq!(
            error.code(),
            ErrorCode::ResourceUnsupported,
            "raw ref {raw:?}"
        );
    }
}

#[test]
fn path_components_are_case_sensitive() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(
        &canonical(&fixture.root.join("Sub")),
        GrantScope::Session,
    )];

    let allowed =
        paths::authorize_local_read(&probe, &fixture.root(), "Sub/c.md", &grants).unwrap();
    assert!(matches!(allowed, LocalReadOutcome::Authorized(_)));
    let denied =
        paths::authorize_local_read(&probe, &fixture.root(), "sub/b.md", &grants).unwrap_err();
    assert_eq!(denied.code(), ErrorCode::AuthOutsideRoot);
}

#[test]
fn percent_decoding_happens_before_resolution() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let outcome =
        paths::authorize_local_read(&probe, &fixture.sub(), "%2e%2e/a.md", &grants).unwrap();
    match outcome {
        LocalReadOutcome::Authorized(read) => {
            assert_eq!(read.canonical_path, canonical(&fixture.root.join("a.md")));
        }
        other => panic!("expected authorization, got {other:?}"),
    }
}

#[test]
fn missing_target_inside_root_is_resource_missing() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let error =
        paths::authorize_local_read(&probe, &fixture.sub(), "missing.md", &grants).unwrap_err();
    assert_eq!(error.code(), ErrorCode::ResourceMissing);
}

#[test]
fn missing_target_outside_root_is_denied() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let error =
        paths::authorize_local_read(&probe, &fixture.sub(), "../../outside/missing.md", &grants)
            .unwrap_err();
    assert_eq!(error.code(), ErrorCode::AuthOutsideRoot);
    assert_eq!(
        root_candidate(&error),
        canonical(&fixture.outside).to_string_lossy().into_owned()
    );
}

#[test]
fn absolute_references_are_used_as_is() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let inside = canonical(&fixture.root.join("a.md"));
    let outcome =
        paths::authorize_local_read(&probe, &fixture.sub(), inside.to_str().unwrap(), &grants)
            .unwrap();
    assert!(matches!(outcome, LocalReadOutcome::Authorized(_)));

    let outside = canonical(&fixture.outside.join("secret.md"));
    let error =
        paths::authorize_local_read(&probe, &fixture.sub(), outside.to_str().unwrap(), &grants)
            .unwrap_err();
    assert_eq!(error.code(), ErrorCode::AuthOutsideRoot);
}

#[test]
fn file_grant_authorizes_exactly_one_file() {
    let fixture = Fixture::new();
    let probe = SystemPathProbe;
    let grants = [file_grant(&canonical(&fixture.root.join("a.md")))];

    let allowed = paths::authorize_local_read(&probe, &fixture.root(), "a.md", &grants).unwrap();
    match allowed {
        LocalReadOutcome::Authorized(read) => {
            assert_eq!(read.canonical_path, canonical(&fixture.root.join("a.md")));
        }
        other => panic!("expected authorization, got {other:?}"),
    }
    // Cleaning is lexical first, so this still resolves to the granted file.
    let cleaned =
        paths::authorize_local_read(&probe, &fixture.root(), "sub/../a.md", &grants).unwrap();
    assert!(matches!(cleaned, LocalReadOutcome::Authorized(_)));

    let denied = paths::authorize_local_read(&probe, &fixture.root(), "b.md", &grants);
    // b.md does not exist at the root either, so this reports missing inside
    // no directory grant; use the existing sub/b.md for an out-of-grant check.
    assert!(denied.is_err());
    let denied_existing =
        paths::authorize_local_read(&probe, &fixture.root(), "sub/b.md", &grants).unwrap_err();
    assert_eq!(denied_existing.code(), ErrorCode::AuthOutsideRoot);
}

// A probe that scripts canonicalize() results for one target path; it lets the
// tests exercise the TOCTOU re-check without racing real writes.
struct ScriptedProbe {
    target: PathBuf,
    resolutions: RefCell<VecDeque<PathBuf>>,
}

impl ScriptedProbe {
    fn new(target: PathBuf, resolutions: Vec<PathBuf>) -> Self {
        Self {
            target,
            resolutions: RefCell::new(resolutions.into()),
        }
    }
}

impl PathProbe for ScriptedProbe {
    fn exists(&self, path: &Path) -> bool {
        path == self.target || SystemPathProbe.exists(path)
    }

    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
        if path == self.target {
            self.resolutions
                .borrow_mut()
                .pop_front()
                .ok_or_else(|| io::Error::other("scripted resolution exhausted"))
        } else {
            SystemPathProbe.canonicalize(path)
        }
    }

    fn is_readable(&self, path: &Path) -> bool {
        SystemPathProbe.is_readable(path)
    }
}

#[test]
fn toctou_change_is_retried_once_and_can_succeed() {
    let fixture = Fixture::new();
    let target = fixture.sub.join("target.md"); // intentionally absent
    let inside = canonical(&fixture.root.join("a.md"));
    let outside = canonical(&fixture.outside.join("secret.md"));
    let probe = ScriptedProbe::new(
        target.clone(),
        vec![inside.clone(), outside, inside.clone(), inside.clone()],
    );
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let outcome = paths::authorize_local_read(&probe, &fixture.sub(), "target.md", &grants)
        .expect("a transient canonical change must be retried once");
    match outcome {
        LocalReadOutcome::Authorized(read) => assert_eq!(read.canonical_path, inside),
        other => panic!("expected authorization, got {other:?}"),
    }
}

#[test]
fn toctou_unstable_resolution_is_denied_with_io_changed() {
    let fixture = Fixture::new();
    let target = fixture.sub.join("target.md");
    let inside = canonical(&fixture.root.join("a.md"));
    let outside = canonical(&fixture.outside.join("secret.md"));
    let probe = ScriptedProbe::new(
        target,
        vec![inside.clone(), outside.clone(), inside, outside],
    );
    let grants = [directory_grant(&fixture.root(), GrantScope::Session)];

    let error =
        paths::authorize_local_read(&probe, &fixture.sub(), "target.md", &grants).unwrap_err();
    assert_eq!(error.code(), ErrorCode::IoChanged);
}

struct ErrorProbe {
    kind: io::ErrorKind,
}

impl PathProbe for ErrorProbe {
    fn exists(&self, _path: &Path) -> bool {
        true
    }

    fn canonicalize(&self, _path: &Path) -> io::Result<PathBuf> {
        Err(io::Error::from(self.kind))
    }

    fn is_readable(&self, _path: &Path) -> bool {
        true
    }
}

#[test]
fn resolution_errors_map_to_taxonomy_codes() {
    let fixture = Fixture::new();
    let grants = [directory_grant(&fixture.root(), GrantScope::Persistent)];

    let permission = paths::authorize_local_read(
        &ErrorProbe {
            kind: io::ErrorKind::PermissionDenied,
        },
        &fixture.root(),
        "a.md",
        &grants,
    )
    .unwrap_err();
    assert_eq!(permission.code(), ErrorCode::IoPermission);

    let not_found = paths::authorize_local_read(
        &ErrorProbe {
            kind: io::ErrorKind::NotFound,
        },
        &fixture.root(),
        "a.md",
        &grants,
    )
    .unwrap_err();
    assert_eq!(not_found.code(), ErrorCode::IoNotFound);
}

// ---------------------------------------------------------------------------
// auth.rs — registry behavior (data-model §3.2)
// ---------------------------------------------------------------------------

#[test]
fn file_grant_is_idempotent_and_listed_once() {
    let fixture = Fixture::new();
    let mut registry = AuthRegistry::new();
    let path = canonical(&fixture.root.join("a.md"));

    let first = registry.grant_file(&path, 1_000).unwrap();
    let second = registry.grant_file(&path, 2_000).unwrap();
    assert_eq!(first.grant_id, second.grant_id);
    assert_eq!(
        first.granted_at_ms, 1_000,
        "re-grant returns the existing record"
    );
    assert_eq!(second.scope, GrantScope::Persistent);
    assert_eq!(registry.list().len(), 1);

    let hex = first.grant_id.strip_prefix("g-").unwrap();
    assert_eq!(hex.len(), 16);
    assert!(hex.chars().all(|character| character.is_ascii_hexdigit()));
}

#[test]
fn directory_grant_promotes_session_to_persistent_without_duplicates() {
    let fixture = Fixture::new();
    let mut registry = AuthRegistry::new();
    let root = fixture.root();

    let session = registry.grant_directory(&root, false, 1).unwrap();
    assert_eq!(session.scope, GrantScope::Session);
    let session_again = registry.grant_directory(&root, false, 2).unwrap();
    assert_eq!(session.grant_id, session_again.grant_id);

    let persistent = registry.grant_directory(&root, true, 3).unwrap();
    assert_eq!(persistent.scope, GrantScope::Persistent);
    assert_ne!(persistent.grant_id, session.grant_id);
    assert_eq!(registry.list().len(), 1);

    let persistent_again = registry.grant_directory(&root, true, 4).unwrap();
    assert_eq!(persistent.grant_id, persistent_again.grant_id);

    // A later session-scope request must not downgrade the persistent grant.
    let downgrade = registry.grant_directory(&root, false, 5).unwrap();
    assert_eq!(downgrade.scope, GrantScope::Persistent);
    assert_eq!(registry.list().len(), 1);
}

#[test]
fn revoke_stops_new_reads_and_removes_asset_scope() {
    let fixture = Fixture::new();
    let mut registry = AuthRegistry::new();
    let grant = registry.grant_directory(&fixture.root(), false, 1).unwrap();
    let probe = SystemPathProbe;

    let outcome = registry
        .authorize_local_read(&probe, &fixture.sub(), "b.md")
        .unwrap();
    let LocalReadOutcome::Authorized(read) = outcome else {
        panic!("expected authorization");
    };
    assert!(registry.asset_scope().contains(&read.canonical_path));

    let revoked = registry.revoke(&grant.grant_id).unwrap();
    assert!(revoked.revoked);
    assert_eq!(revoked.cancelled_requests, 0);
    assert_eq!(revoked.removed_cache_entries, 0);
    assert!(registry.asset_scope().is_empty());
    assert!(registry.list().is_empty());

    let denied = registry
        .authorize_local_read(&probe, &fixture.sub(), "b.md")
        .unwrap_err();
    assert_eq!(denied.code(), ErrorCode::AuthOutsideRoot);

    let second_revoke = registry.revoke(&grant.grant_id).unwrap_err();
    assert_eq!(second_revoke.code(), ErrorCode::IoNotFound);
}

#[test]
fn revoking_a_directory_removes_scope_entries_below_the_root() {
    let fixture = Fixture::new();
    let mut registry = AuthRegistry::new();
    let grant = registry.grant_directory(&fixture.root(), false, 1).unwrap();
    let probe = SystemPathProbe;

    let allowed = registry
        .authorize_local_read(&probe, &fixture.sub(), "b.md")
        .unwrap();
    let LocalReadOutcome::Authorized(first) = allowed else {
        panic!("expected authorization");
    };
    let allowed = registry
        .authorize_local_read(&probe, &fixture.root(), "a.md")
        .unwrap();
    let LocalReadOutcome::Authorized(second) = allowed else {
        panic!("expected authorization");
    };
    assert!(registry.asset_scope().contains(&first.canonical_path));
    assert!(registry.asset_scope().contains(&second.canonical_path));

    registry.revoke(&grant.grant_id).unwrap();
    assert!(registry.asset_scope().is_empty());
}

#[test]
fn remote_session_grants_are_per_document_and_idempotent() {
    let mut registry = AuthRegistry::new();
    let origins = vec!["https://images.example.com".to_owned()];

    let first = registry.grant_remote_session("d-1", &origins, 1).unwrap();
    let again = registry.grant_remote_session("d-1", &origins, 2).unwrap();
    assert_eq!(first.grant_id, again.grant_id);
    assert_eq!(first.scope, GrantScope::Session);

    let other_doc = registry.grant_remote_session("d-2", &origins, 3).unwrap();
    assert_ne!(first.grant_id, other_doc.grant_id);
    assert_eq!(registry.list().len(), 2);
    assert_eq!(registry.active_origins("d-1"), origins);

    let revoked = registry.revoke_remote_session("d-1");
    assert!(revoked.revoked);
    assert!(registry.active_origins("d-1").is_empty());
    assert_eq!(registry.active_origins("d-2"), origins);

    let idempotent = registry.revoke_remote_session("d-1");
    assert!(!idempotent.revoked);

    let empty = registry.grant_remote_session("d-3", &[], 4).unwrap_err();
    assert_eq!(empty.code(), ErrorCode::RemoteProtocol);
}

#[test]
fn startup_revalidation_clears_session_and_marks_missing_persistent() {
    let fixture = Fixture::new();
    let mut registry = AuthRegistry::new();
    let probe = SystemPathProbe;

    let file_ok = registry
        .grant_file(&canonical(&fixture.root.join("a.md")), 1)
        .unwrap();
    let sub_dir = registry
        .grant_directory(&canonical(&fixture.root.join("Sub")), true, 2)
        .unwrap();
    let session_dir = registry.grant_directory(&fixture.root(), false, 3).unwrap();
    let missing = registry
        .grant_file(&fixture.root().join("gone.md"), 4)
        .unwrap();

    // Before revalidation the session directory grant authorizes the subdir.
    let allowed = registry
        .authorize_local_read(&probe, &fixture.sub(), "b.md")
        .unwrap();
    assert!(matches!(allowed, LocalReadOutcome::Authorized(_)));

    let report = registry.revalidate_startup(&probe);
    assert_eq!(report.session_removed, 1);
    assert_eq!(report.persistent_checked, 3);
    assert_eq!(report.persistent_available, 2);
    assert_eq!(report.persistent_unavailable, 1);
    assert_eq!(report.unavailable_grant_ids, vec![missing.grant_id.clone()]);

    assert!(!registry.is_unavailable(&file_ok.grant_id));
    assert!(!registry.is_unavailable(&sub_dir.grant_id));
    assert!(registry.is_unavailable(&missing.grant_id));
    assert!(!registry.is_unavailable(&session_dir.grant_id));

    // Session grant is gone: the subdirectory is no longer reachable.
    let denied = registry
        .authorize_local_read(&probe, &fixture.sub(), "b.md")
        .unwrap_err();
    assert_eq!(denied.code(), ErrorCode::AuthOutsideRoot);

    // The persistent file grant still works, the unavailable one does not.
    let allowed = registry
        .authorize_local_read(&probe, &fixture.root(), "a.md")
        .unwrap();
    assert!(matches!(allowed, LocalReadOutcome::Authorized(_)));
    assert!(!registry.has_local_access(&fixture.root().join("gone.md")));

    // Re-confirming (re-granting) the missing file clears unavailability.
    let regranted = registry
        .grant_file(&fixture.root().join("gone.md"), 5)
        .unwrap();
    assert_eq!(regranted.grant_id, missing.grant_id);
    assert!(!registry.is_unavailable(&missing.grant_id));
}

#[cfg(unix)]
#[test]
fn unreadable_persistent_grant_is_marked_unavailable() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = Fixture::new();
    let denied_dir = fixture.root.join("denied");
    std::fs::create_dir_all(&denied_dir).unwrap();
    write_file(&denied_dir.join("d.md"), "# d\n");
    let probe = SystemPathProbe;

    std::fs::set_permissions(&denied_dir, std::fs::Permissions::from_mode(0o000)).unwrap();
    let unreadable = !probe.is_readable(&denied_dir);
    let mut registry = AuthRegistry::new();
    let grant = registry
        .grant_directory(&canonical(&denied_dir), true, 1)
        .unwrap();
    let report = registry.revalidate_startup(&probe);
    std::fs::set_permissions(&denied_dir, std::fs::Permissions::from_mode(0o755)).unwrap();

    if !unreadable {
        // Running as root (or a filesystem without mode enforcement): the
        // permission precondition cannot be created here.
        eprintln!("skipping permission assertion: directory remains readable");
        return;
    }
    assert_eq!(report.persistent_unavailable, 1);
    assert!(registry.is_unavailable(&grant.grant_id));
}

#[derive(Debug, Default)]
struct RecordingStore {
    upserts: Mutex<Vec<String>>,
    deletes: Mutex<Vec<String>>,
    fail_upsert: bool,
}

#[derive(Debug)]
struct StoreHandle(Arc<RecordingStore>);

impl GrantPersistence for StoreHandle {
    fn load_all(&self) -> Result<Vec<GrantRecord>, paperstack_lib::error::AppError> {
        Ok(Vec::new())
    }

    fn upsert(&self, record: &GrantRecord) -> Result<(), paperstack_lib::error::AppError> {
        if self.0.fail_upsert {
            return Err(paperstack_lib::error::AppError::new(ErrorCode::DbFailure));
        }
        self.0.upserts.lock().unwrap().push(record.grant_id.clone());
        Ok(())
    }

    fn delete(&self, grant_id: &str) -> Result<(), paperstack_lib::error::AppError> {
        self.0.deletes.lock().unwrap().push(grant_id.to_owned());
        Ok(())
    }
}

#[test]
fn persistence_hook_receives_upserts_and_deletes() {
    let fixture = Fixture::new();
    let store = Arc::new(RecordingStore::default());
    let mut registry = AuthRegistry::with_persistence(Box::new(StoreHandle(store.clone())));
    let path = canonical(&fixture.root.join("a.md"));

    let grant = registry.grant_file(&path, 1).unwrap();
    assert_eq!(store.upserts.lock().unwrap().len(), 1);

    // Idempotent re-grant does not touch persistence again.
    registry.grant_file(&path, 2).unwrap();
    assert_eq!(store.upserts.lock().unwrap().len(), 1);

    registry.revoke(&grant.grant_id).unwrap();
    assert_eq!(store.deletes.lock().unwrap().as_slice(), [grant.grant_id]);
}

#[test]
fn persistence_failure_is_surfaced_and_grant_is_not_added() {
    let fixture = Fixture::new();
    let store = Arc::new(RecordingStore {
        fail_upsert: true,
        ..RecordingStore::default()
    });
    let mut registry = AuthRegistry::with_persistence(Box::new(StoreHandle(store)));

    let error = registry
        .grant_file(&canonical(&fixture.root.join("a.md")), 1)
        .unwrap_err();
    assert_eq!(error.code(), ErrorCode::DbFailure);
    assert!(registry.list().is_empty());
}
