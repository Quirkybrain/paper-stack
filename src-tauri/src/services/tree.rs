//! Directory tree services: `open_directory` / `read_directory`
//! (contracts §2.1 commands 9–10, §3.2; R02/R25; security-model §2).
//!
//! One directory is listed at a time (lazy children, no recursive scan).
//! Symlinks are reported, never followed for child listing: the node keeps
//! its own path and the target decides the `symlink-inside` /
//! `symlink-outside` state. The in-memory root registry is mirrored into the
//! authorization registry / asset scope by the command layer (wp-15); this
//! service only validates and lists.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use crate::error::{AppError, ErrorCode};
use crate::models::{
    DirectoryListing, DirectoryNode, DirectoryNodeKind, DirectoryNodeStatus, DirectoryRoot,
    GrantScope,
};
use crate::services::paths::{self, is_within_root};

/// Single-directory initial listing cap (contracts §3.2).
pub const MAX_DIRECTORY_ENTRIES: usize = 2000;

/// `rootId` follows the opaque `g-`/`d-` identifier pattern; contracts do not
/// freeze the spelling, but re-opening the same canonical directory must be
/// idempotent, so the id is derived from the canonical path.
pub fn root_id_for(canonical_path: &str) -> String {
    let digest = Sha256::digest(canonical_path.as_bytes());
    let mut encoded = hex::encode(digest);
    encoded.truncate(16);
    format!("r-{encoded}")
}

#[derive(Debug, Clone)]
struct RootEntry {
    root: DirectoryRoot,
    canonical: PathBuf,
}

/// In-memory directory-root registry (session/persistent scope; R25).
#[derive(Debug, Default)]
pub struct TreeService {
    roots: BTreeMap<String, RootEntry>,
}

impl TreeService {
    pub fn new() -> Self {
        Self::default()
    }

    /// `open_directory` validation (command 9): the target must exist, be a
    /// readable directory and become an authorized root. Re-opening the same
    /// canonical path is idempotent and `persist=true` upgrades the scope.
    pub fn open_directory(&mut self, path: &str, persist: bool) -> Result<DirectoryRoot, AppError> {
        let canonical = fs::canonicalize(path).map_err(AppError::from_io_read)?;
        let metadata = fs::metadata(&canonical).map_err(AppError::from_io_read)?;
        if !metadata.is_dir() {
            return Err(AppError::new(ErrorCode::FormatUnsupported)
                .with_message("open_directory target is not a directory"));
        }
        // Readability probe: `read_dir` is the operation the tree needs.
        fs::read_dir(&canonical).map_err(map_directory_error)?;

        let canonical_path = canonical.to_string_lossy().into_owned();
        let root_id = root_id_for(&canonical_path);
        if let Some(existing) = self.roots.get_mut(&root_id) {
            if persist {
                existing.root.scope = GrantScope::Persistent;
            }
            return Ok(existing.root.clone());
        }
        let root = DirectoryRoot {
            root_id: root_id.clone(),
            canonical_path,
            display_name: display_name_for(&canonical),
            scope: if persist {
                GrantScope::Persistent
            } else {
                GrantScope::Session
            },
        };
        self.roots.insert(
            root_id,
            RootEntry {
                root: root.clone(),
                canonical,
            },
        );
        Ok(root)
    }

    /// Registered root by id (read accessor for the command layer).
    pub fn root(&self, root_id: &str) -> Option<&DirectoryRoot> {
        self.roots.get(root_id).map(|entry| &entry.root)
    }

    pub fn roots(&self) -> impl Iterator<Item = &DirectoryRoot> {
        self.roots.values().map(|entry| &entry.root)
    }

    pub fn is_empty(&self) -> bool {
        self.roots.is_empty()
    }

    /// `read_directory` (command 10): one lazy level, name-sorted, truncated
    /// at 2000 entries with an explicit flag. `dirPath` is canonicalized and
    /// component-checked against the authorized root; entries outside the
    /// root (symlink targets) are reported as `symlink-outside`, never
    /// followed.
    pub fn read_directory(
        &self,
        root_id: &str,
        dir_path: &str,
    ) -> Result<DirectoryListing, AppError> {
        let entry = self
            .roots
            .get(root_id)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        let canonical = fs::canonicalize(dir_path).map_err(AppError::from_io_read)?;
        if !is_within_root(&entry.canonical, &canonical) {
            return Err(AppError::new(ErrorCode::AuthOutsideRoot));
        }
        let metadata = fs::metadata(&canonical).map_err(AppError::from_io_read)?;
        if !metadata.is_dir() {
            return Err(AppError::new(ErrorCode::FormatUnsupported)
                .with_message("read_directory target is not a directory"));
        }
        let mut paths: Vec<PathBuf> = fs::read_dir(&canonical)
            .map_err(map_directory_error)?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .collect();
        paths.sort_by(|left, right| left.file_name().cmp(&right.file_name()));
        let truncated = paths.len() > MAX_DIRECTORY_ENTRIES;
        paths.truncate(MAX_DIRECTORY_ENTRIES);
        let entries = paths
            .iter()
            .map(|path| node_for(path, &entry.canonical))
            .collect();
        Ok(DirectoryListing {
            dir_path: canonical.to_string_lossy().into_owned(),
            entries,
            truncated,
        })
    }
}

fn node_for(path: &Path, root: &Path) -> DirectoryNode {
    let name = display_name_for(path);
    let symlink_metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) => {
            return DirectoryNode {
                name,
                path: path.to_string_lossy().into_owned(),
                kind: DirectoryNodeKind::Other,
                status: status_for_error(&error),
                has_children: None,
                is_markdown: None,
                symlink_target: None,
            };
        }
    };
    let file_type = symlink_metadata.file_type();
    if file_type.is_symlink() {
        let symlink_target = fs::read_link(path)
            .ok()
            .map(|target| target.to_string_lossy().into_owned());
        return match fs::canonicalize(path) {
            Ok(target) => {
                if is_within_root(root, &target) {
                    let (has_children, status) = match fs::metadata(&target) {
                        Ok(metadata) if metadata.is_dir() => probe_directory(&target),
                        Ok(_) => (None, DirectoryNodeStatus::Ok),
                        Err(error) => (None, status_for_error(&error)),
                    };
                    DirectoryNode {
                        name,
                        path: path.to_string_lossy().into_owned(),
                        kind: DirectoryNodeKind::Symlink,
                        status: if status == DirectoryNodeStatus::Ok {
                            DirectoryNodeStatus::SymlinkInside
                        } else {
                            status
                        },
                        has_children,
                        is_markdown: None,
                        symlink_target,
                    }
                } else {
                    DirectoryNode {
                        name,
                        path: path.to_string_lossy().into_owned(),
                        kind: DirectoryNodeKind::Symlink,
                        status: DirectoryNodeStatus::SymlinkOutside,
                        has_children: None,
                        is_markdown: None,
                        symlink_target,
                    }
                }
            }
            Err(error) => DirectoryNode {
                name,
                path: path.to_string_lossy().into_owned(),
                kind: DirectoryNodeKind::Symlink,
                status: status_for_error(&error),
                has_children: None,
                is_markdown: None,
                symlink_target,
            },
        };
    }
    if file_type.is_dir() {
        let (has_children, status) = probe_directory(path);
        return DirectoryNode {
            name,
            path: path.to_string_lossy().into_owned(),
            kind: DirectoryNodeKind::Directory,
            status,
            has_children,
            is_markdown: None,
            symlink_target: None,
        };
    }
    if file_type.is_file() {
        return DirectoryNode {
            name,
            path: path.to_string_lossy().into_owned(),
            kind: DirectoryNodeKind::File,
            status: DirectoryNodeStatus::Ok,
            has_children: None,
            is_markdown: Some(paths::has_markdown_extension(path)),
            symlink_target: None,
        };
    }
    DirectoryNode {
        name,
        path: path.to_string_lossy().into_owned(),
        kind: DirectoryNodeKind::Other,
        status: DirectoryNodeStatus::Ok,
        has_children: None,
        is_markdown: None,
        symlink_target: None,
    }
}

/// Probes whether a directory has any child (one `readdir`, no recursion).
fn probe_directory(path: &Path) -> (Option<bool>, DirectoryNodeStatus) {
    match fs::read_dir(path) {
        Ok(mut entries) => (Some(entries.next().is_some()), DirectoryNodeStatus::Ok),
        Err(error) => (None, status_for_error(&error)),
    }
}

fn status_for_error(error: &std::io::Error) -> DirectoryNodeStatus {
    match error.kind() {
        std::io::ErrorKind::NotFound => DirectoryNodeStatus::Missing,
        std::io::ErrorKind::PermissionDenied => DirectoryNodeStatus::NoPermission,
        _ => DirectoryNodeStatus::Missing,
    }
}

fn map_directory_error(error: std::io::Error) -> AppError {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => AppError::new(ErrorCode::IoPermission),
        std::io::ErrorKind::NotFound => AppError::new(ErrorCode::IoNotFound),
        _ => AppError::new(ErrorCode::IoReadFailed),
    }
    .with_source(error)
}

fn display_name_for(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn root_ids_are_stable_and_well_formed() {
        let first = root_id_for("/home/user/notes");
        assert_eq!(first, root_id_for("/home/user/notes"));
        assert_ne!(first, root_id_for("/home/user/other"));
        let hex = first.strip_prefix("r-").expect("r- prefix");
        assert_eq!(hex.len(), 16);
        assert!(hex.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
