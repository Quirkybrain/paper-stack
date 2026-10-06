//! Authorization registry — grant/revoke/list for file, directory and remote
//! targets, asset-scope bookkeeping and startup revalidation
//! (`security-model.md` §2–§4; `data-model.md` §3.2; ADR-005).
//!
//! This is the in-memory core. Persistence hooks are expressed by
//! [`GrantPersistence`] and wired to SQLite by the storage task (wp-11); wp-08
//! intentionally ships no database code.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{AppError, ErrorCode};
use crate::models::{GrantKind, GrantRecord, GrantScope, RevokeResult};
use crate::services::asset_scope::AssetScopeController;
use crate::services::paths::{self, LocalReadOutcome, PathProbe};

/// Persistence hook for the future `services/storage` integration. The three
/// operations mirror the registry's needs; implementations must be
/// deterministic and return `PS_DB_FAILURE` on database errors.
pub trait GrantPersistence: Send + Sync + std::fmt::Debug {
    fn load_all(&self) -> Result<Vec<GrantRecord>, AppError>;
    fn upsert(&self, record: &GrantRecord) -> Result<(), AppError>;
    fn delete(&self, grant_id: &str) -> Result<(), AppError>;
}

/// In-memory asset-protocol scope. The command layer (wp-15) mirrors this set
/// into the real Tauri asset scope; the security model never lets the frontend
/// construct asset URLs itself (R25).
#[derive(Debug, Default, Clone)]
pub struct AssetScope {
    files: HashSet<PathBuf>,
}

impl AssetScope {
    /// Adds an exact canonical file path; returns `true` when newly added.
    pub fn allow_file(&mut self, path: impl Into<PathBuf>) -> bool {
        self.files.insert(path.into())
    }

    /// Removes one exact file from the scope.
    pub fn revoke_file(&mut self, path: &Path) -> bool {
        self.files.remove(path)
    }

    /// Removes every scope entry at or below `root` (directory revoke).
    pub fn revoke_under(&mut self, root: &Path) -> usize {
        let doomed: Vec<PathBuf> = self
            .files
            .iter()
            .filter(|path| path.starts_with(root))
            .cloned()
            .collect();
        doomed
            .iter()
            .filter(|path| self.files.remove(*path))
            .count()
    }

    pub fn contains(&self, path: &Path) -> bool {
        self.files.contains(path)
    }

    pub fn len(&self) -> usize {
        self.files.len()
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }

    /// Current scope entries (for wiring the real asset scope later).
    pub fn paths(&self) -> impl Iterator<Item = &PathBuf> {
        self.files.iter()
    }
}

/// Outcome of [`AuthRegistry::revalidate_startup`] (data-model §3.2).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RevalidationReport {
    /// `scope='session'` rows deleted at startup.
    pub session_removed: usize,
    /// `scope='persistent'` rows re-checked.
    pub persistent_checked: usize,
    pub persistent_available: usize,
    /// Records kept but marked unavailable; using them requires a fresh
    /// confirmation (R25).
    pub persistent_unavailable: usize,
    pub unavailable_grant_ids: Vec<String>,
    /// Session-scope removals whose runtime asset-scope shrink failed. The
    /// registry still removed them; the caller may log the failure.
    pub scope_revoke_failures: usize,
}

/// Per-record status of [`AuthRegistry::revoke_all_for_clear`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClearRevokeStatus {
    /// Removed from the registry and, when attached, shrunk in the runtime
    /// asset scope.
    Revoked,
    /// Removed from the registry, but the runtime asset-scope shrink failed.
    ScopeFailed,
}

/// One record's outcome inside a clear-driven revocation (contracts §2.1).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClearRevokeItem {
    pub grant_id: String,
    pub kind: GrantKind,
    pub status: ClearRevokeStatus,
}

/// Runtime-effect report of [`AuthRegistry::revoke_all_for_clear`]
/// (contracts §2.1; R25/R27).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ClearRevocationOutcome {
    /// One item per removed grant, in registry order.
    pub items: Vec<ClearRevokeItem>,
    /// Distinct document sessions whose remote grants were removed; the
    /// command layer deletes their cache entries (R26, command 29 semantics).
    pub remote_doc_ids: Vec<String>,
}

impl ClearRevocationOutcome {
    pub fn removed(&self) -> usize {
        self.items.len()
    }

    pub fn scope_failed(&self) -> usize {
        self.items
            .iter()
            .filter(|item| item.status == ClearRevokeStatus::ScopeFailed)
            .count()
    }
}

/// In-memory authorization registry.
#[derive(Debug, Default)]
pub struct AuthRegistry {
    grants: Vec<GrantRecord>,
    unavailable: HashSet<String>,
    asset_scope: AssetScope,
    /// Runtime asset-protocol scope bridge (wp-14a). `None` in unit tests and
    /// embedded use without a Tauri app handle.
    runtime_scope: Option<AssetScopeController>,
    persistence: Option<Box<dyn GrantPersistence>>,
}

impl AuthRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_persistence(persistence: Box<dyn GrantPersistence>) -> Self {
        Self {
            persistence: Some(persistence),
            ..Self::default()
        }
    }

    /// Attaches the runtime asset-protocol scope (wp-14a): grants and
    /// revocations then mirror into the Tauri scope through the single
    /// [`AssetScopeController`] mapping. Without it the registry only
    /// maintains the in-memory [`AssetScope`] mirror.
    pub fn set_runtime_scope(&mut self, scope: AssetScopeController) {
        self.runtime_scope = Some(scope);
    }

    /// Seeds records, e.g. from storage on startup, before
    /// [`Self::revalidate_startup`].
    pub fn load_grants(&mut self, records: Vec<GrantRecord>) {
        self.grants = records;
        self.unavailable.clear();
    }

    pub fn asset_scope(&self) -> &AssetScope {
        &self.asset_scope
    }

    pub fn grants(&self) -> &[GrantRecord] {
        &self.grants
    }

    pub fn list(&self) -> Vec<GrantRecord> {
        self.grants.clone()
    }

    pub fn get(&self, grant_id: &str) -> Option<&GrantRecord> {
        self.grants.iter().find(|grant| grant.grant_id == grant_id)
    }

    pub fn is_unavailable(&self, grant_id: &str) -> bool {
        self.unavailable.contains(grant_id)
    }

    /// Grants persistent single-file read access (data-model §3.2). Re-granting
    /// the same canonical path returns the existing record (contracts §1.7).
    pub fn grant_file(
        &mut self,
        canonical_path: &Path,
        now_ms: i64,
    ) -> Result<GrantRecord, AppError> {
        let path = path_string(canonical_path);
        let record = GrantRecord {
            grant_id: grant_id_for(GrantKind::File, &path, GrantScope::Persistent),
            kind: GrantKind::File,
            scope: GrantScope::Persistent,
            canonical_path: Some(path),
            origins: None,
            doc_id: None,
            granted_at_ms: now_ms,
        };
        self.upsert(record)
    }

    /// Grants directory read access; `persist=false` creates a session grant,
    /// `persist=true` a persistent one. A persistent grant supersedes a
    /// session grant for the same root, and re-grants are idempotent.
    pub fn grant_directory(
        &mut self,
        canonical_path: &Path,
        persist: bool,
        now_ms: i64,
    ) -> Result<GrantRecord, AppError> {
        let path = path_string(canonical_path);
        if let Some(existing) = self.find_local(GrantKind::Directory, &path) {
            let existing = existing.clone();
            if existing.scope == GrantScope::Persistent || !persist {
                self.unavailable.remove(&existing.grant_id);
                // Re-confirmation (or re-open) re-applies the exact scope
                // mapping, keeping the runtime scope in sync when the grant
                // predates this process (loaded from storage).
                self.apply_grant_scope(&existing)?;
                return Ok(existing);
            }
            // Upgrade session -> persistent for the same root.
            self.remove_by_id(&existing.grant_id)?;
        }
        let scope = if persist {
            GrantScope::Persistent
        } else {
            GrantScope::Session
        };
        let record = GrantRecord {
            grant_id: grant_id_for(GrantKind::Directory, &path, scope),
            kind: GrantKind::Directory,
            scope,
            canonical_path: Some(path),
            origins: None,
            doc_id: None,
            granted_at_ms: now_ms,
        };
        self.upsert(record)
    }

    /// Grants a document-session remote-origin allowance (R26). Origins are
    /// normalized (trimmed, sorted, deduplicated); re-granting the same origin
    /// set for the same document returns the existing record.
    pub fn grant_remote_session(
        &mut self,
        doc_id: &str,
        origins: &[String],
        now_ms: i64,
    ) -> Result<GrantRecord, AppError> {
        let normalized = normalize_origins(origins);
        if normalized.is_empty() {
            return Err(AppError::new(ErrorCode::RemoteProtocol)
                .with_message("grant_remote_session requires at least one origin"));
        }
        let record = remote_record(doc_id, &normalized, now_ms);
        self.upsert(record)
    }

    /// Session-scoped fallback for the memory-degrade path (NF08): registers a
    /// persistent file grant in memory without touching the persistence hook.
    /// The command layer calls this only after the persistent write failed; the
    /// returned record honestly carries `session` scope. A runtime-scope
    /// failure surfaces as an error while the grant stays registered
    /// (fail-closed: no asset URL can serve without the scope entry).
    pub fn grant_file_session(
        &mut self,
        canonical_path: &Path,
        now_ms: i64,
    ) -> Result<GrantRecord, AppError> {
        let path = path_string(canonical_path);
        self.push_memory_grant(GrantRecord {
            grant_id: grant_id_for(GrantKind::File, &path, GrantScope::Session),
            kind: GrantKind::File,
            scope: GrantScope::Session,
            canonical_path: Some(path),
            origins: None,
            doc_id: None,
            granted_at_ms: now_ms,
        })
    }

    /// Session-scoped directory fallback for the memory-degrade path (NF08).
    pub fn grant_directory_session(
        &mut self,
        canonical_path: &Path,
        now_ms: i64,
    ) -> Result<GrantRecord, AppError> {
        let path = path_string(canonical_path);
        self.push_memory_grant(GrantRecord {
            grant_id: grant_id_for(GrantKind::Directory, &path, GrantScope::Session),
            kind: GrantKind::Directory,
            scope: GrantScope::Session,
            canonical_path: Some(path),
            origins: None,
            doc_id: None,
            granted_at_ms: now_ms,
        })
    }

    /// Session-scoped remote fallback for the memory-degrade path (NF08).
    pub fn grant_remote_session_memory(
        &mut self,
        doc_id: &str,
        origins: &[String],
        now_ms: i64,
    ) -> Result<GrantRecord, AppError> {
        let normalized = normalize_origins(origins);
        self.push_memory_grant(remote_record(doc_id, &normalized, now_ms))
    }

    /// Active origins for one document session, used by the remote policy
    /// (wp-13).
    pub fn active_origins(&self, doc_id: &str) -> Vec<String> {
        let mut origins: Vec<String> = self
            .grants
            .iter()
            .filter(|grant| {
                grant.kind == GrantKind::Remote
                    && grant.doc_id.as_deref() == Some(doc_id)
                    && !self.unavailable.contains(&grant.grant_id)
            })
            .filter_map(|grant| grant.origins.clone())
            .flatten()
            .collect();
        origins.sort();
        origins.dedup();
        origins
    }

    /// Revokes by grant id. Unknown ids are `PS_IO_NOT_FOUND` (command 27).
    /// Revoking removes the matching asset scope entries: exact file for file
    /// grants, everything at/below the root for directory grants.
    pub fn revoke(&mut self, grant_id: &str) -> Result<RevokeResult, AppError> {
        let removed: Vec<GrantRecord> = self
            .grants
            .iter()
            .filter(|grant| grant.grant_id == grant_id)
            .cloned()
            .collect();
        if removed.is_empty() {
            return Err(AppError::new(ErrorCode::IoNotFound));
        }
        self.grants.retain(|grant| grant.grant_id != grant_id);
        if let Some(store) = &self.persistence {
            store.delete(grant_id)?;
        }
        self.unavailable.remove(grant_id);
        let mut scope_failure = None;
        for record in &removed {
            self.drop_scope_for(record);
            if let Some(scope) = &self.runtime_scope {
                if let Err(error) = scope.revoke(record) {
                    scope_failure.get_or_insert(error);
                }
            }
        }
        if let Some(error) = scope_failure {
            // The grant is gone from the registry and storage; the runtime
            // scope shrink failed. Fail-closed surfaces the error instead of
            // pretending the revocation is complete.
            return Err(error);
        }
        Ok(RevokeResult {
            revoked: true,
            cancelled_requests: 0,
            removed_cache_entries: 0,
        })
    }

    /// Revokes all remote-session grants of one document (command 29 is
    /// idempotent and never rejects).
    pub fn revoke_remote_session(&mut self, doc_id: &str) -> RevokeResult {
        let removed: Vec<GrantRecord> = self
            .grants
            .iter()
            .filter(|grant| {
                grant.kind == GrantKind::Remote && grant.doc_id.as_deref() == Some(doc_id)
            })
            .cloned()
            .collect();
        if removed.is_empty() {
            return RevokeResult {
                revoked: false,
                cancelled_requests: 0,
                removed_cache_entries: 0,
            };
        }
        self.grants.retain(|grant| {
            !(grant.kind == GrantKind::Remote && grant.doc_id.as_deref() == Some(doc_id))
        });
        if let Some(store) = &self.persistence {
            for record in &removed {
                // Best-effort: the runtime effect must not be blocked by a
                // storage hiccup; the row is revalidated at next startup.
                let _ = store.delete(&record.grant_id);
            }
        }
        for record in &removed {
            self.unavailable.remove(&record.grant_id);
        }
        // Remote grants carry no local path; their cached files are revoked
        // through `AssetScopeController::revoke_file` by the command layer,
        // which owns the cache keys (R26).
        RevokeResult {
            revoked: true,
            cancelled_requests: 0,
            removed_cache_entries: 0,
        }
    }

    /// Runtime effect of `clear_records(["authorizations"])` (contracts §2.1;
    /// IX12; R25/R27): removes every in-memory grant and shrinks the runtime
    /// asset scope for each local record, mirroring [`Self::revoke`]. The
    /// database rows are deleted by `Storage::clear_records` inside its own
    /// transaction, so this intentionally does not touch [`GrantPersistence`].
    /// Remote document sessions are reported so the command layer can delete
    /// their cache entries (R26). Nothing is re-granted here: a cleared path
    /// requires a fresh explicit user authorization (data-model §3.2).
    pub fn revoke_all_for_clear(&mut self) -> ClearRevocationOutcome {
        let removed: Vec<GrantRecord> = std::mem::take(&mut self.grants);
        self.unavailable.clear();
        let mut outcome = ClearRevocationOutcome::default();
        for record in &removed {
            self.drop_scope_for(record);
            let status = match &self.runtime_scope {
                Some(scope) => match scope.revoke(record) {
                    Ok(()) => ClearRevokeStatus::Revoked,
                    Err(_) => ClearRevokeStatus::ScopeFailed,
                },
                None => ClearRevokeStatus::Revoked,
            };
            if record.kind == GrantKind::Remote {
                if let Some(doc_id) = &record.doc_id {
                    if !outcome.remote_doc_ids.contains(doc_id) {
                        outcome.remote_doc_ids.push(doc_id.clone());
                    }
                }
            }
            outcome.items.push(ClearRevokeItem {
                grant_id: record.grant_id.clone(),
                kind: record.kind,
                status,
            });
        }
        outcome
    }

    /// Startup revalidation (data-model §3.2): session rows are deleted;
    /// persistent rows are kept but re-checked for existence and system read
    /// permission. Failures are marked unavailable and require fresh
    /// confirmation when used (R25).
    pub fn revalidate_startup(&mut self, probe: &dyn PathProbe) -> RevalidationReport {
        let mut report = RevalidationReport::default();
        let mut retained = Vec::with_capacity(self.grants.len());
        for record in std::mem::take(&mut self.grants) {
            if record.scope == GrantScope::Session {
                report.session_removed += 1;
                self.unavailable.remove(&record.grant_id);
                // Session-scope cleanup revokes the runtime scope for exactly
                // the removed record. In the production startup order the
                // scope is attached after this run (the static scope starts
                // empty), so this only fires for a mid-process revalidation.
                if let Some(scope) = &self.runtime_scope {
                    if scope.revoke(&record).is_err() {
                        report.scope_revoke_failures += 1;
                    }
                }
                continue;
            }
            report.persistent_checked += 1;
            let available = match record.kind {
                GrantKind::File | GrantKind::Directory => record
                    .canonical_path
                    .as_deref()
                    .map(Path::new)
                    .is_some_and(|path| probe.exists(path) && probe.is_readable(path)),
                // Remote grants are session-scoped by contract; a persistent
                // remote row can never be trusted.
                GrantKind::Remote => false,
            };
            if available {
                report.persistent_available += 1;
                self.unavailable.remove(&record.grant_id);
            } else {
                report.persistent_unavailable += 1;
                report.unavailable_grant_ids.push(record.grant_id.clone());
                self.unavailable.insert(record.grant_id.clone());
            }
            retained.push(record);
        }
        self.grants = retained;
        report
    }

    /// Runs the `security-model.md` §2.2 algorithm against the effective
    /// (available, local) grants and records the canonical file in the asset
    /// scope on success.
    pub fn authorize_local_read(
        &mut self,
        probe: &dyn PathProbe,
        base_dir: &Path,
        raw_ref: &str,
    ) -> Result<LocalReadOutcome, AppError> {
        let effective: Vec<GrantRecord> = self
            .grants
            .iter()
            .filter(|grant| {
                matches!(grant.kind, GrantKind::File | GrantKind::Directory)
                    && !self.unavailable.contains(&grant.grant_id)
            })
            .cloned()
            .collect();
        let outcome = paths::authorize_local_read(probe, base_dir, raw_ref, &effective)?;
        if let LocalReadOutcome::Authorized(read) = &outcome {
            self.asset_scope.allow_file(read.canonical_path.clone());
            if let Some(scope) = &self.runtime_scope {
                // Step 9: the exact canonical file becomes servable only now.
                scope.allow_file(&read.canonical_path)?;
            }
        }
        Ok(outcome)
    }

    /// Read access check without running the full algorithm (used by resource
    /// and opener services for already-canonical targets).
    pub fn has_local_access(&self, canonical: &Path) -> bool {
        self.grants.iter().any(|grant| {
            !self.unavailable.contains(&grant.grant_id)
                && match grant.kind {
                    GrantKind::File => {
                        grant.canonical_path.as_deref().map(Path::new) == Some(canonical)
                    }
                    GrantKind::Directory => grant
                        .canonical_path
                        .as_deref()
                        .map(Path::new)
                        .is_some_and(|root| paths::is_within_root(root, canonical)),
                    GrantKind::Remote => false,
                }
        })
    }

    fn find_local(&self, kind: GrantKind, canonical_path: &str) -> Option<&GrantRecord> {
        self.grants.iter().find(|grant| {
            grant.kind == kind && grant.canonical_path.as_deref() == Some(canonical_path)
        })
    }

    fn upsert(&mut self, record: GrantRecord) -> Result<GrantRecord, AppError> {
        if let Some(existing) = self
            .grants
            .iter()
            .find(|grant| grant.grant_id == record.grant_id && same_binding(grant, &record))
        {
            // Idempotent re-grant: reuse the existing id (contracts §1.7);
            // re-confirmation clears a stale "unavailable" mark.
            let existing = existing.clone();
            self.unavailable.remove(&existing.grant_id);
            self.apply_grant_scope(&existing)?;
            return Ok(existing);
        }
        if let Some(store) = &self.persistence {
            store.upsert(&record)?;
        }
        self.apply_grant_scope(&record)?;
        self.grants.push(record.clone());
        self.unavailable.remove(&record.grant_id);
        Ok(record)
    }

    /// In-memory-only insert for the persistence-degraded fallbacks above
    /// (idempotent on the grant id). The record is registered first so a
    /// runtime-scope failure cannot lose the authorization decision.
    fn push_memory_grant(&mut self, record: GrantRecord) -> Result<GrantRecord, AppError> {
        if let Some(existing) = self
            .grants
            .iter()
            .find(|grant| grant.grant_id == record.grant_id)
        {
            let existing = existing.clone();
            self.apply_grant_scope(&existing)?;
            return Ok(existing);
        }
        self.grants.push(record.clone());
        self.unavailable.remove(&record.grant_id);
        self.apply_grant_scope(&record)?;
        Ok(record)
    }

    fn apply_grant_scope(&self, record: &GrantRecord) -> Result<(), AppError> {
        match &self.runtime_scope {
            Some(scope) => scope.grant(record),
            None => Ok(()),
        }
    }

    fn remove_by_id(&mut self, grant_id: &str) -> Result<(), AppError> {
        // Only used by the session -> persistent upgrade of the same root;
        // the runtime scope is intentionally left alone because the new
        // persistent record re-allows the same subtree, and the forbidden set
        // has no removal API.
        self.grants.retain(|grant| grant.grant_id != grant_id);
        self.unavailable.remove(grant_id);
        if let Some(store) = &self.persistence {
            store.delete(grant_id)?;
        }
        Ok(())
    }

    fn drop_scope_for(&mut self, record: &GrantRecord) {
        let Some(path) = record.canonical_path.as_deref() else {
            return;
        };
        match record.kind {
            GrantKind::File => {
                self.asset_scope.revoke_file(Path::new(path));
            }
            GrantKind::Directory => {
                self.asset_scope.revoke_under(Path::new(path));
            }
            GrantKind::Remote => {}
        }
    }
}

fn same_binding(left: &GrantRecord, right: &GrantRecord) -> bool {
    match left.kind {
        // Remote grant ids can coincide across documents with equal origin
        // sets; the document session is part of the binding.
        GrantKind::Remote => left.doc_id == right.doc_id,
        GrantKind::File | GrantKind::Directory => true,
    }
}

fn normalize_origins(origins: &[String]) -> Vec<String> {
    let mut normalized: Vec<String> = origins
        .iter()
        .map(|origin| origin.trim().to_owned())
        .filter(|origin| !origin.is_empty())
        .collect();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn remote_record(doc_id: &str, normalized: &[String], now_ms: i64) -> GrantRecord {
    // The grant id folds in the document session: remote grants are per
    // document session, and grant ids are unique across documents
    // (data-model §3.2).
    let target = normalized.join(",");
    GrantRecord {
        grant_id: grant_id_for_remote(doc_id, &target, GrantScope::Session),
        kind: GrantKind::Remote,
        scope: GrantScope::Session,
        canonical_path: None,
        origins: Some(normalized.to_vec()),
        doc_id: Some(doc_id.to_owned()),
        granted_at_ms: now_ms,
    }
}

/// `grantId = "g-" + first16hex(sha256(kind | canonicalPath | scope))`
/// (data-model §3.2).
fn grant_id_for(kind: GrantKind, target: &str, scope: GrantScope) -> String {
    let kind = match kind {
        GrantKind::File => "file",
        GrantKind::Directory => "directory",
        GrantKind::Remote => "remote",
    };
    let scope = match scope {
        GrantScope::Session => "session",
        GrantScope::Persistent => "persistent",
    };
    format!(
        "g-{}",
        first16_sha256_hex(format!("{kind}|{target}|{scope}").as_bytes())
    )
}

/// Remote variant of the id formula; `{docId}` is folded into the target part
/// so per-document session grants stay distinct (see evidence report).
fn grant_id_for_remote(doc_id: &str, origins_joined: &str, scope: GrantScope) -> String {
    let scope = match scope {
        GrantScope::Session => "session",
        GrantScope::Persistent => "persistent",
    };
    format!(
        "g-{}",
        first16_sha256_hex(format!("remote|{doc_id}|{origins_joined}|{scope}").as_bytes())
    )
}

fn first16_sha256_hex(input: &[u8]) -> String {
    let digest = Sha256::digest(input);
    let mut encoded = hex::encode(digest);
    encoded.truncate(16);
    encoded
}

fn path_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grant_ids_are_stable_and_well_formed() {
        let first = grant_id_for(
            GrantKind::Directory,
            "/home/user/notes",
            GrantScope::Session,
        );
        let second = grant_id_for(
            GrantKind::Directory,
            "/home/user/notes",
            GrantScope::Session,
        );
        assert_eq!(first, second);
        assert_ne!(
            first,
            grant_id_for(
                GrantKind::Directory,
                "/home/user/notes",
                GrantScope::Persistent
            )
        );
        let hex = first.strip_prefix("g-").expect("g- prefix");
        assert_eq!(hex.len(), 16);
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn asset_scope_add_remove_and_subtree_revoke() {
        let mut scope = AssetScope::default();
        assert!(scope.allow_file("/notes/a.md"));
        assert!(!scope.allow_file("/notes/a.md"));
        assert!(scope.allow_file("/notes/sub/b.md"));
        assert!(scope.allow_file("/other/c.md"));
        assert_eq!(scope.revoke_under(Path::new("/notes")), 2);
        assert!(scope.contains(Path::new("/other/c.md")));
        assert!(!scope.contains(Path::new("/notes/a.md")));
        assert_eq!(scope.len(), 1);
        assert!(!scope.is_empty());
    }
}
