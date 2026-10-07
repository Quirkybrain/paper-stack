//! Offline legal-text resolution tests (wp-43 C2; R30/AT30).
//!
//! `read_legal_text` (contract command 34) must find the bundled `LICENSE` /
//! `THIRD_PARTY_NOTICES.md` resources in the Tauri resource directory (that is
//! where `tauri-bundler` places the configured bundle resources in
//! production), fall back to the development repository root, and keep the
//! graceful `PS_IO_NOT_FOUND` path when neither root holds the file.

use std::fs;

use paperstack_lib::error::ErrorCode;
use paperstack_lib::models::LegalTextKind;
use paperstack_lib::services::info::{
    dev_repo_root, InfoService, LEGAL_LICENSE_RESOURCE, LEGAL_THIRD_PARTY_RESOURCE,
};

#[test]
fn resource_dir_wins_and_repo_root_fallback_resolves_the_other_text() {
    let bundled = tempfile::tempdir().unwrap();
    let repo_root = tempfile::tempdir().unwrap();
    fs::write(
        bundled.path().join(LEGAL_LICENSE_RESOURCE),
        "bundled license bytes",
    )
    .unwrap();
    fs::write(
        repo_root.path().join(LEGAL_THIRD_PARTY_RESOURCE),
        "fallback notices bytes",
    )
    .unwrap();

    let service = InfoService::new(bundled.path()).with_fallback_dir(repo_root.path());
    assert_eq!(service.legal_availability(), (true, true));

    let license = service.read_legal_text(LegalTextKind::License).unwrap();
    assert_eq!(license.text, "bundled license bytes");
    assert_eq!(license.resource_name, LEGAL_LICENSE_RESOURCE);

    let notices = service
        .read_legal_text(LegalTextKind::ThirdPartyNotices)
        .unwrap();
    assert_eq!(notices.text, "fallback notices bytes");
    assert_eq!(notices.resource_name, LEGAL_THIRD_PARTY_RESOURCE);
}

#[test]
fn missing_resources_are_reported_as_unavailable_and_read_as_io_not_found() {
    let empty = tempfile::tempdir().unwrap();
    let service = InfoService::new(empty.path());
    assert_eq!(service.legal_availability(), (false, false));
    assert_eq!(
        service
            .read_legal_text(LegalTextKind::License)
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );
    assert_eq!(
        service
            .read_legal_text(LegalTextKind::ThirdPartyNotices)
            .unwrap_err()
            .code(),
        ErrorCode::IoNotFound
    );
}

#[test]
fn debug_builds_resolve_the_checkout_root_where_the_repo_legal_files_live() {
    // `dev_repo_root` is `None` in release test builds (no build-machine path
    // is ever consulted by a shipped binary); in debug builds it must point at
    // the checkout that holds the actual `LICENSE`.
    let Some(root) = dev_repo_root() else {
        return;
    };
    assert!(
        root.join(LEGAL_LICENSE_RESOURCE).is_file(),
        "dev repo root {} should contain {LEGAL_LICENSE_RESOURCE}",
        root.display()
    );
    assert!(
        root.join(LEGAL_THIRD_PARTY_RESOURCE).is_file(),
        "dev repo root {} should contain {LEGAL_THIRD_PARTY_RESOURCE}",
        root.display()
    );
}
