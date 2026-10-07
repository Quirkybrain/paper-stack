//! Directory tree listing tests (T-11): root registry, lazy children,
//! symlink state reporting, 2000-entry truncation and
//! out-of-root / permission / missing states.

use std::fs;
use std::path::{Path, PathBuf};

use paperstack_lib::commands::tree::read_directory_checked;
use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::{DirectoryNodeKind, DirectoryNodeStatus, GrantScope};
use paperstack_lib::services::auth::AuthRegistry;
use paperstack_lib::services::tree::{TreeService, MAX_DIRECTORY_ENTRIES};
use tempfile::TempDir;

fn tree_root() -> PathBuf {
    fs::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/tree/root")).unwrap()
}

fn path_str(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn node<'a>(
    listing: &'a paperstack_lib::models::DirectoryListing,
    name: &str,
) -> &'a paperstack_lib::models::DirectoryNode {
    listing
        .entries
        .iter()
        .find(|entry| entry.name == name)
        .unwrap_or_else(|| panic!("missing entry {name}"))
}

#[test]
fn open_directory_is_idempotent_and_scope_upgrades() {
    let root = tree_root();
    let mut service = TreeService::new();
    let session = service.open_directory(&path_str(&root), false).unwrap();
    assert_eq!(session.scope, GrantScope::Session);
    assert_eq!(session.display_name, "root");
    assert!(session.root_id.starts_with("r-"));
    assert_eq!(session.root_id.len(), 18);

    let again = service.open_directory(&path_str(&root), false).unwrap();
    assert_eq!(session.root_id, again.root_id);

    let persistent = service.open_directory(&path_str(&root), true).unwrap();
    assert_eq!(persistent.root_id, session.root_id);
    assert_eq!(persistent.scope, GrantScope::Persistent);
    assert_eq!(
        service.root(&session.root_id).unwrap().scope,
        GrantScope::Persistent
    );
}

#[test]
fn read_directory_reports_node_states_for_one_lazy_level() {
    let root = tree_root();
    let mut service = TreeService::new();
    let opened = service.open_directory(&path_str(&root), false).unwrap();
    let listing = service
        .read_directory(&opened.root_id, &path_str(&root))
        .unwrap();

    let names: Vec<&str> = listing
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    assert_eq!(
        names,
        vec![
            "a.md",
            "empty",
            "link-broken",
            "link-inside",
            "link-inside-file.md",
            "link-outside",
            "sub"
        ]
    );
    assert!(!listing.truncated);
    assert_eq!(listing.dir_path, path_str(&root));

    let file = node(&listing, "a.md");
    assert_eq!(file.kind, DirectoryNodeKind::File);
    assert_eq!(file.status, DirectoryNodeStatus::Ok);
    assert_eq!(file.is_markdown, Some(true));
    assert_eq!(file.has_children, None);

    let directory = node(&listing, "sub");
    assert_eq!(directory.kind, DirectoryNodeKind::Directory);
    assert_eq!(directory.status, DirectoryNodeStatus::Ok);
    assert_eq!(directory.has_children, Some(true));

    let marker_only = node(&listing, "empty");
    assert_eq!(marker_only.kind, DirectoryNodeKind::Directory);
    // The committed fixture carries a `.keep` marker; a truly empty
    // directory is covered by the tempdir test below.
    assert_eq!(marker_only.has_children, Some(true));

    let inside = node(&listing, "link-inside");
    assert_eq!(inside.kind, DirectoryNodeKind::Symlink);
    assert_eq!(inside.status, DirectoryNodeStatus::SymlinkInside);
    assert_eq!(inside.has_children, Some(true));
    assert_eq!(inside.symlink_target.as_deref(), Some("sub"));

    let inside_file = node(&listing, "link-inside-file.md");
    assert_eq!(inside_file.kind, DirectoryNodeKind::Symlink);
    assert_eq!(inside_file.status, DirectoryNodeStatus::SymlinkInside);
    assert_eq!(inside_file.has_children, None);
    assert_eq!(inside_file.symlink_target.as_deref(), Some("a.md"));

    let outside = node(&listing, "link-outside");
    assert_eq!(outside.kind, DirectoryNodeKind::Symlink);
    assert_eq!(outside.status, DirectoryNodeStatus::SymlinkOutside);
    assert_eq!(outside.symlink_target.as_deref(), Some("../outside"));

    let broken = node(&listing, "link-broken");
    assert_eq!(broken.kind, DirectoryNodeKind::Symlink);
    assert_eq!(broken.status, DirectoryNodeStatus::Missing);
    assert_eq!(broken.symlink_target.as_deref(), Some("missing-target"));
}

#[test]
fn symlink_inside_resolves_to_the_target_listing_and_outside_is_denied() {
    let root = tree_root();
    let mut service = TreeService::new();
    let opened = service.open_directory(&path_str(&root), false).unwrap();

    let inside = service
        .read_directory(&opened.root_id, &path_str(&root.join("link-inside")))
        .unwrap();
    assert_eq!(inside.dir_path, path_str(&root.join("sub")));
    let names: Vec<&str> = inside
        .entries
        .iter()
        .map(|entry| entry.name.as_str())
        .collect();
    assert_eq!(names, vec!["b.md", "deep"]);

    let escape = service
        .read_directory(&opened.root_id, &path_str(&root.join("link-outside")))
        .unwrap_err();
    assert_eq!(escape.code(), ErrorCode::AuthOutsideRoot);

    let outside =
        fs::canonicalize(Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/tree/outside"))
            .unwrap();
    let denied = service
        .read_directory(&opened.root_id, &path_str(&outside))
        .unwrap_err();
    assert_eq!(denied.code(), ErrorCode::AuthOutsideRoot);
}

#[test]
fn read_directory_reports_missing_and_not_a_directory() {
    let root = tree_root();
    let mut service = TreeService::new();
    let opened = service.open_directory(&path_str(&root), false).unwrap();

    let missing = service
        .read_directory(&opened.root_id, &path_str(&root.join("does-not-exist")))
        .unwrap_err();
    assert_eq!(missing.code(), ErrorCode::IoNotFound);

    let file = service
        .read_directory(&opened.root_id, &path_str(&root.join("a.md")))
        .unwrap_err();
    assert_eq!(file.code(), ErrorCode::FormatUnsupported);

    let unknown_root = service
        .read_directory("r-0000000000000000", &path_str(&root))
        .unwrap_err();
    assert_eq!(unknown_root.code(), ErrorCode::IoNotFound);
}

#[test]
fn open_directory_validates_the_target() {
    let temp = TempDir::new().unwrap();
    let missing = temp.path().join("missing");
    let file = temp.path().join("file.md");
    fs::write(&file, "# file\n").unwrap();

    let mut service = TreeService::new();
    assert_eq!(
        service
            .open_directory(&path_str(&missing), false)
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );
    assert_eq!(
        service
            .open_directory(&path_str(&file), false)
            .unwrap_err()
            .code(),
        ErrorCode::FormatUnsupported
    );
}

#[test]
fn read_directory_reports_an_empty_directory() {
    let temp = TempDir::new().unwrap();
    fs::create_dir(temp.path().join("empty")).unwrap();
    let mut service = TreeService::new();
    let opened = service
        .open_directory(&path_str(temp.path()), false)
        .unwrap();

    let listing = service
        .read_directory(&opened.root_id, &path_str(&temp.path().join("empty")))
        .unwrap();
    assert!(listing.entries.is_empty());
    assert!(!listing.truncated);

    let root_listing = service
        .read_directory(&opened.root_id, &path_str(temp.path()))
        .unwrap();
    assert_eq!(node(&root_listing, "empty").has_children, Some(false));
}

#[test]
fn read_directory_truncates_at_two_thousand_entries() {
    let temp = TempDir::new().unwrap();
    let total = MAX_DIRECTORY_ENTRIES + 5;
    for index in 0..total {
        fs::write(temp.path().join(format!("f{index:04}.md")), "# x\n").unwrap();
    }
    let mut service = TreeService::new();
    let opened = service
        .open_directory(&path_str(temp.path()), false)
        .unwrap();
    let listing = service
        .read_directory(&opened.root_id, &path_str(temp.path()))
        .unwrap();

    assert_eq!(listing.entries.len(), MAX_DIRECTORY_ENTRIES);
    assert!(listing.truncated);
    assert_eq!(listing.entries.first().unwrap().name, "f0000.md");
    assert_eq!(listing.entries.last().unwrap().name, "f1999.md");
}

#[test]
fn read_directory_reports_denied_child_and_denied_root_when_not_root() {
    use std::os::unix::fs::PermissionsExt;
    let temp = TempDir::new().unwrap();
    let denied = temp.path().join("denied");
    fs::create_dir(&denied).unwrap();
    fs::write(denied.join("hidden.md"), "# hidden\n").unwrap();

    let mut service = TreeService::new();
    let opened = service
        .open_directory(&path_str(temp.path()), false)
        .unwrap();

    fs::set_permissions(&denied, fs::Permissions::from_mode(0o000)).unwrap();
    let denied_probe = fs::read_dir(&denied).is_ok();

    let listing = service
        .read_directory(&opened.root_id, &path_str(temp.path()))
        .unwrap();
    let denied_node = node(&listing, "denied");
    if denied_probe {
        // Running as root: chmod 000 does not restrict, skip the assertions.
        assert_eq!(denied_node.status, DirectoryNodeStatus::Ok);
    } else {
        assert_eq!(denied_node.status, DirectoryNodeStatus::NoPermission);
        let error = service
            .read_directory(&opened.root_id, &path_str(&denied))
            .unwrap_err();
        assert_eq!(error.code(), ErrorCode::IoPermission);
    }

    fs::set_permissions(&denied, fs::Permissions::from_mode(0o755)).unwrap();
}

#[test]
fn read_directory_after_directory_revoke_is_denied() {
    let root = tree_root();
    let mut tree = TreeService::new();
    let opened = tree.open_directory(&path_str(&root), false).unwrap();
    let mut auth = AuthRegistry::new();
    let grant = auth
        .grant_directory(Path::new(&opened.canonical_path), false, 1)
        .unwrap();

    // Before the revoke the command path lists normally.
    let listing = read_directory_checked(&tree, &auth, &opened.root_id, &path_str(&root)).unwrap();
    assert!(!listing.entries.is_empty());

    // A-02: revoking the directory grant stops further scans immediately
    // (INV-AZ-06; security-model §2.1: no listing until re-confirmation).
    auth.revoke(&grant.grant_id).unwrap();
    let denied =
        read_directory_checked(&tree, &auth, &opened.root_id, &path_str(&root)).unwrap_err();
    assert_eq!(denied.code(), ErrorCode::AuthRevoked);
    let sub_denied =
        read_directory_checked(&tree, &auth, &opened.root_id, &path_str(&root.join("sub")))
            .unwrap_err();
    assert_eq!(sub_denied.code(), ErrorCode::AuthRevoked);

    // An explicit user re-open (command 9) re-establishes the authorization.
    auth.grant_directory(Path::new(&opened.canonical_path), false, 2)
        .unwrap();
    assert!(read_directory_checked(&tree, &auth, &opened.root_id, &path_str(&root)).is_ok());
}

#[test]
fn read_directory_after_authorization_clear_is_denied() {
    let root = tree_root();
    let mut tree = TreeService::new();
    let opened = tree.open_directory(&path_str(&root), false).unwrap();
    let mut auth = AuthRegistry::new();
    auth.grant_directory(Path::new(&opened.canonical_path), false, 1)
        .unwrap();
    assert!(read_directory_checked(&tree, &auth, &opened.root_id, &path_str(&root)).is_ok());

    // clear_records(["authorizations"]) empties the registry; the retained
    // rootId must not keep listing (data-model §3.2: no automatic re-grant).
    let outcome = auth.revoke_all_for_clear();
    assert_eq!(outcome.removed(), 1);
    let denied =
        read_directory_checked(&tree, &auth, &opened.root_id, &path_str(&root)).unwrap_err();
    assert_eq!(denied.code(), ErrorCode::AuthRevoked);
    assert!(auth.list().is_empty());
}

#[test]
fn read_directory_reports_non_file_non_directory_entries_as_other() {
    use std::os::unix::net::UnixListener;
    let temp = TempDir::new().unwrap();
    let socket_path = temp.path().join("socket.sock");
    let _listener = UnixListener::bind(&socket_path).unwrap();

    let mut service = TreeService::new();
    let opened = service
        .open_directory(&path_str(temp.path()), false)
        .unwrap();
    let listing = service
        .read_directory(&opened.root_id, &path_str(temp.path()))
        .unwrap();
    let socket = node(&listing, "socket.sock");
    assert_eq!(socket.kind, DirectoryNodeKind::Other);
    assert_eq!(socket.status, DirectoryNodeStatus::Ok);
}
