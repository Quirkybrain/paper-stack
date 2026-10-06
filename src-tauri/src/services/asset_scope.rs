//! Runtime asset-protocol scope management (security-model §6; §2.2 step 9;
//! contracts §9 asset row; R25).
//!
//! `tauri.conf.json` enables the asset protocol with an **empty static
//! scope**. A path becomes servable only after the trusted Rust side reaches
//! an authorization decision: a file/directory grant, a successful
//! [`crate::services::auth::AuthRegistry::authorize_local_read`] (§2.2), or a
//! controlled remote fetch that produced a cache file. This module is the
//! single mapping point from those decisions to the Tauri
//! `asset_protocol_scope()` operations; the [`AssetScopeBackend`] seam keeps
//! the mapping testable without a real app handle.
//!
//! Shrinking uses the scope's forbidden set. Tauri's `Scope::is_allowed`
//! checks forbidden patterns before allowed ones and the forbidden set has no
//! removal API in the pinned version (tauri 2.12.1), so a revoked path stays
//! unservable for the rest of the process (recorded limitation, see the
//! wp-14a evidence report).

use std::fmt;
use std::path::Path;
use std::sync::Arc;

use tauri::Manager;

use crate::error::{AppError, ErrorCode};
use crate::models::{GrantKind, GrantRecord};

/// Operations the runtime scope must support. Production uses
/// [`TauriAssetScope`]; tests use recording doubles.
pub trait AssetScopeBackend: Send + Sync + fmt::Debug {
    fn allow_file(&self, path: &Path) -> Result<(), AppError>;
    fn allow_directory(&self, path: &Path, recursive: bool) -> Result<(), AppError>;
    fn forbid_file(&self, path: &Path) -> Result<(), AppError>;
    fn forbid_directory(&self, path: &Path, recursive: bool) -> Result<(), AppError>;
}

/// Production backend over the Tauri asset-protocol scope. The scope is only
/// available once the `tauri` `protocol-asset` feature is enabled
/// (`Cargo.toml`), which pairs with `app.security.assetProtocol.enable=true`.
pub struct TauriAssetScope {
    app: tauri::AppHandle,
}

impl TauriAssetScope {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self { app }
    }
}

impl fmt::Debug for TauriAssetScope {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.debug_struct("TauriAssetScope").finish()
    }
}

fn scope_error(error: tauri::Error) -> AppError {
    AppError::new(ErrorCode::Internal)
        .with_message("asset protocol scope update failed")
        .with_source(error)
}

impl AssetScopeBackend for TauriAssetScope {
    fn allow_file(&self, path: &Path) -> Result<(), AppError> {
        self.app
            .asset_protocol_scope()
            .allow_file(path)
            .map_err(scope_error)
    }

    fn allow_directory(&self, path: &Path, recursive: bool) -> Result<(), AppError> {
        self.app
            .asset_protocol_scope()
            .allow_directory(path, recursive)
            .map_err(scope_error)
    }

    fn forbid_file(&self, path: &Path) -> Result<(), AppError> {
        self.app
            .asset_protocol_scope()
            .forbid_file(path)
            .map_err(scope_error)
    }

    fn forbid_directory(&self, path: &Path, recursive: bool) -> Result<(), AppError> {
        self.app
            .asset_protocol_scope()
            .forbid_directory(path, recursive)
            .map_err(scope_error)
    }
}

/// Single mapping point from authorization decisions to runtime scope
/// operations. Clones share one backend.
#[derive(Debug, Clone)]
pub struct AssetScopeController {
    backend: Arc<dyn AssetScopeBackend>,
}

impl AssetScopeController {
    pub fn new(backend: Arc<dyn AssetScopeBackend>) -> Self {
        Self { backend }
    }

    /// Expands the scope for one grant: exact file for file grants, the whole
    /// subtree for directory grants; remote grants carry no local path.
    pub fn grant(&self, record: &GrantRecord) -> Result<(), AppError> {
        self.map_record(record, MapAction::Allow)
    }

    /// Shrinks the scope for one revoked grant. The forbidden pattern makes
    /// the path unservable even while the allowed pattern remains.
    pub fn revoke(&self, record: &GrantRecord) -> Result<(), AppError> {
        self.map_record(record, MapAction::Forbid)
    }

    /// Allows one exact canonical file (authorized read without a matching
    /// grant record, remote cache file).
    pub fn allow_file(&self, path: &Path) -> Result<(), AppError> {
        self.backend.allow_file(path)
    }

    /// Forbids one exact file (remote-session cache cleanup).
    pub fn revoke_file(&self, path: &Path) -> Result<(), AppError> {
        self.backend.forbid_file(path)
    }

    fn map_record(&self, record: &GrantRecord, action: MapAction) -> Result<(), AppError> {
        let Some(path) = record.canonical_path.as_deref() else {
            return Ok(());
        };
        let path = Path::new(path);
        match (record.kind, action) {
            (GrantKind::File, MapAction::Allow) => self.backend.allow_file(path),
            (GrantKind::File, MapAction::Forbid) => self.backend.forbid_file(path),
            (GrantKind::Directory, MapAction::Allow) => self.backend.allow_directory(path, true),
            (GrantKind::Directory, MapAction::Forbid) => self.backend.forbid_directory(path, true),
            (GrantKind::Remote, _) => Ok(()),
        }
    }
}

#[derive(Clone, Copy)]
enum MapAction {
    Allow,
    Forbid,
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Mutex;

    use super::*;
    use crate::models::GrantScope;
    use crate::services::auth::AuthRegistry;
    use crate::services::paths::{LocalReadOutcome, SystemPathProbe};

    /// Deterministic scope double: records the exact call sequence.
    #[derive(Debug, Default)]
    struct RecordingBackend {
        ops: Mutex<Vec<String>>,
    }

    impl RecordingBackend {
        fn ops(&self) -> Vec<String> {
            self.ops.lock().unwrap().clone()
        }
    }

    impl AssetScopeBackend for RecordingBackend {
        fn allow_file(&self, path: &Path) -> Result<(), AppError> {
            self.ops
                .lock()
                .unwrap()
                .push(format!("allow_file {}", path.display()));
            Ok(())
        }

        fn allow_directory(&self, path: &Path, recursive: bool) -> Result<(), AppError> {
            self.ops
                .lock()
                .unwrap()
                .push(format!("allow_directory {recursive} {}", path.display()));
            Ok(())
        }

        fn forbid_file(&self, path: &Path) -> Result<(), AppError> {
            self.ops
                .lock()
                .unwrap()
                .push(format!("forbid_file {}", path.display()));
            Ok(())
        }

        fn forbid_directory(&self, path: &Path, recursive: bool) -> Result<(), AppError> {
            self.ops
                .lock()
                .unwrap()
                .push(format!("forbid_directory {recursive} {}", path.display()));
            Ok(())
        }
    }

    fn controller() -> (AssetScopeController, Arc<RecordingBackend>) {
        let backend = Arc::new(RecordingBackend::default());
        (AssetScopeController::new(backend.clone()), backend)
    }

    struct Fixture {
        _temp: tempfile::TempDir,
        root: PathBuf,
    }

    impl Fixture {
        fn new() -> Self {
            let temp = tempfile::tempdir().unwrap();
            let root = temp.path().join("root");
            fs::create_dir_all(root.join("sub")).unwrap();
            fs::write(root.join("a.md"), "# a\n").unwrap();
            fs::write(root.join("sub/b.md"), "# b\n").unwrap();
            let root = fs::canonicalize(root).unwrap();
            Self { _temp: temp, root }
        }

        fn file(&self, relative: &str) -> PathBuf {
            fs::canonicalize(self.root.join(relative)).unwrap()
        }
    }

    fn record(kind: GrantKind, path: &Path) -> GrantRecord {
        GrantRecord {
            grant_id: format!("g-test-{}", path.display()),
            kind,
            scope: GrantScope::Session,
            canonical_path: Some(path.to_string_lossy().into_owned()),
            origins: None,
            doc_id: None,
            granted_at_ms: 0,
        }
    }

    #[test]
    fn file_grant_allows_the_exact_path_and_revoke_forbids_it() {
        let (controller, backend) = controller();
        let target = Path::new("/notes/a.md");
        let grant = record(GrantKind::File, target);

        controller.grant(&grant).unwrap();
        controller.revoke(&grant).unwrap();

        assert_eq!(
            backend.ops(),
            ["allow_file /notes/a.md", "forbid_file /notes/a.md"]
        );
    }

    #[test]
    fn directory_grant_allows_recursively_and_revoke_forbids_the_subtree() {
        let (controller, backend) = controller();
        let target = Path::new("/notes");
        let grant = record(GrantKind::Directory, target);

        controller.grant(&grant).unwrap();
        controller.revoke(&grant).unwrap();

        assert_eq!(
            backend.ops(),
            [
                "allow_directory true /notes",
                "forbid_directory true /notes",
            ]
        );
    }

    #[test]
    fn remote_grant_maps_to_no_scope_operation() {
        let (controller, backend) = controller();
        let mut grant = record(GrantKind::File, Path::new("/notes/a.md"));
        grant.kind = GrantKind::Remote;
        grant.canonical_path = None;

        controller.grant(&grant).unwrap();
        controller.revoke(&grant).unwrap();

        assert!(backend.ops().is_empty());
    }

    #[test]
    fn exact_file_helpers_map_to_allow_and_forbid() {
        let (controller, backend) = controller();
        let path = Path::new("/cache/remote-images/c-1");

        controller.allow_file(path).unwrap();
        controller.revoke_file(path).unwrap();

        assert_eq!(
            backend.ops(),
            [
                "allow_file /cache/remote-images/c-1",
                "forbid_file /cache/remote-images/c-1",
            ]
        );
    }

    #[test]
    fn denied_decisions_never_expand_the_scope() {
        let fixture = Fixture::new();
        let (controller, backend) = controller();
        let mut registry = AuthRegistry::new();
        registry.set_runtime_scope(controller);
        let probe = SystemPathProbe;

        // No grant at all: the read is outside any root.
        let denied = registry
            .authorize_local_read(&probe, &fixture.root, "a.md")
            .unwrap_err();
        assert_eq!(denied.code(), ErrorCode::AuthOutsideRoot);
        assert!(backend.ops().is_empty());

        // With a directory grant, a missing target reports resource-missing
        // without any scope expansion either.
        registry.grant_directory(&fixture.root, false, 1).unwrap();
        let before_missing = backend.ops();
        let missing = registry
            .authorize_local_read(&probe, &fixture.root, "missing.md")
            .unwrap_err();
        assert_eq!(missing.code(), ErrorCode::ResourceMissing);
        assert_eq!(backend.ops(), before_missing);
    }

    #[test]
    fn grants_reads_and_revocations_drive_the_scope_in_order() {
        let fixture = Fixture::new();
        let (controller, backend) = controller();
        let mut registry = AuthRegistry::new();
        registry.set_runtime_scope(controller);
        let probe = SystemPathProbe;

        let grant = registry.grant_directory(&fixture.root, false, 1).unwrap();
        assert_eq!(
            backend.ops(),
            [format!("allow_directory true {}", fixture.root.display())]
        );

        let outcome = registry
            .authorize_local_read(&probe, &fixture.root, "sub/b.md")
            .unwrap();
        let LocalReadOutcome::Authorized(read) = outcome else {
            panic!("expected an authorized read");
        };
        assert!(registry.asset_scope().contains(&read.canonical_path));
        assert_eq!(
            backend.ops().last().unwrap(),
            &format!("allow_file {}", read.canonical_path.display())
        );

        registry.revoke(&grant.grant_id).unwrap();
        assert_eq!(
            backend.ops().last().unwrap(),
            &format!("forbid_directory true {}", fixture.root.display())
        );
        assert!(registry.asset_scope().is_empty());
    }

    #[test]
    fn session_grants_allow_and_session_cleanup_forbids() {
        let fixture = Fixture::new();
        let (controller, backend) = controller();
        let mut registry = AuthRegistry::new();
        registry.set_runtime_scope(controller);
        let probe = SystemPathProbe;

        let file = fixture.file("a.md");
        registry.grant_file_session(&file, 1).unwrap();
        assert_eq!(backend.ops(), [format!("allow_file {}", file.display())]);

        let report = registry.revalidate_startup(&probe);
        assert_eq!(report.session_removed, 1);
        assert_eq!(report.scope_revoke_failures, 0);
        assert_eq!(
            backend.ops().last().unwrap(),
            &format!("forbid_file {}", file.display())
        );
    }

    #[test]
    fn idempotent_regrant_reapplies_the_allow_mapping() {
        let fixture = Fixture::new();
        let (controller, backend) = controller();
        let mut registry = AuthRegistry::new();
        registry.set_runtime_scope(controller);

        let file = fixture.file("a.md");
        let first = registry.grant_file(&file, 1).unwrap();
        let second = registry.grant_file(&file, 2).unwrap();
        assert_eq!(first.grant_id, second.grant_id);
        assert_eq!(
            backend.ops(),
            [
                format!("allow_file {}", file.display()),
                format!("allow_file {}", file.display()),
            ],
            "a re-confirmation must re-apply the exact allow mapping"
        );
    }
}
