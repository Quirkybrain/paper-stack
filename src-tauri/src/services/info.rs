//! Application information, bundled legal text and opener validation
//! (contracts §2 commands 31–34, §3.7; T-19; R30/R15).
//!
//! The service is deliberately pure besides reading the bundled legal
//! resources: it reports contract-fixed identity metadata, validates external
//! URL schemes (`http`/`https` only, R15) and resolves `reveal_in_folder`
//! targets through the authorization registry. The actual OS side effects
//! (system browser, file manager) stay in the command layer via the pinned
//! opener plugin (contracts §9).

use std::fs;
use std::path::{Path, PathBuf};

use url::Url;

use crate::error::{AppError, ErrorCode};
use crate::models::{AppInfo, AppLegalInfo, LegalTextKind, LegalTextResult};
use crate::services::auth::AuthRegistry;
use crate::services::paths::PathProbe;

/// Display name (contracts §3.7, plan §1.5).
pub const APP_NAME: &str = "纸栈 PaperStack";
/// Real compiled crate version; `Cargo.toml`, `package.json` and
/// `tauri.conf.json` must carry the same value (consistency test).
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
/// Owner (contracts §3.7).
pub const APP_OWNER: &str = "Quirkybrain";
/// SPDX license identifier (contracts §3.7; ADR-008).
pub const APP_LICENSE: &str = "GPL-3.0-only";
/// Frozen IPC contract id (contracts header).
pub const IPC_CONTRACT: &str = "paperstack-ipc-r1";
/// v0.1.0 ships the zh-CN locale only (ADR-009).
pub const APP_LOCALE: &str = "zh-CN";

/// Bundled full license resource name (expected under the Tauri resource
/// directory once the release work package adds it; A11).
pub const LEGAL_LICENSE_RESOURCE: &str = "LICENSE";
/// Bundled third-party notices resource name.
pub const LEGAL_THIRD_PARTY_RESOURCE: &str = "THIRD_PARTY_NOTICES.md";
/// i18n key returned in `AppInfo.legal.sourceEntryNote` while the matching
/// source entry is not configured (A9/NF12). Rust never returns user-visible
/// text (architecture §8); the UI renders this key.
pub const SOURCE_ENTRY_NOTE_KEY: &str = "about.sourceUnconfigured";

/// Application info service over the resource roots that hold the bundled
/// legal texts.
///
/// Resolution order (wp-43 C2): the Tauri resource directory first — that is
/// where `tauri build`/`tauri-bundler` copies the configured bundle resources
/// in production (`/usr/lib/paperstack/`) and where `tauri-build` stages them
/// next to the executable during development — then an optional development
/// repository root (see [`InfoService::with_fallback_dir`] and
/// [`dev_repo_root`]). A missing file in all roots stays the graceful
/// `PS_IO_NOT_FOUND` path; the About page hides the action when the matching
/// `*Available` flag is false.
#[derive(Debug)]
pub struct InfoService {
    resource_dir: PathBuf,
    fallback_dirs: Vec<PathBuf>,
}

impl InfoService {
    pub fn new(resource_dir: impl Into<PathBuf>) -> Self {
        Self {
            resource_dir: resource_dir.into(),
            fallback_dirs: Vec::new(),
        }
    }

    /// Appends an extra root searched after the resource directory. Used by
    /// the development fallback and by tests that simulate a repository root.
    pub fn with_fallback_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.fallback_dirs.push(dir.into());
        self
    }

    pub fn resource_dir(&self) -> &Path {
        &self.resource_dir
    }

    /// First existing candidate for a bundled legal resource, or `None` when
    /// neither the resource directory nor a fallback root holds the file.
    fn resolve_legal_resource(&self, resource_name: &str) -> Option<PathBuf> {
        std::iter::once(&self.resource_dir)
            .chain(self.fallback_dirs.iter())
            .map(|root| root.join(resource_name))
            .find(|path| path.is_file())
    }

    /// `get_app_info` (contract command 33). `sourceEntryUrl` is `null` with an
    /// explicit reason until the owner provides the matching source entry
    /// (A9; release blocker, never a placeholder URL).
    pub fn app_info(&self) -> AppInfo {
        let (license_available, third_party_available) = self.legal_availability();
        AppInfo {
            name: APP_NAME.to_owned(),
            version: APP_VERSION.to_owned(),
            owner: APP_OWNER.to_owned(),
            license: APP_LICENSE.to_owned(),
            ipc_contract: IPC_CONTRACT.to_owned(),
            locale: APP_LOCALE.to_owned(),
            tauri_version: Some(tauri::VERSION.to_owned()),
            webkit_version: None,
            os: Some(runtime_os()),
            legal: AppLegalInfo {
                source_entry_url: None,
                source_entry_note: Some(SOURCE_ENTRY_NOTE_KEY.to_owned()),
                license_available,
                third_party_available,
            },
        }
    }

    /// `(licenseAvailable, thirdPartyAvailable)` for the About page.
    pub fn legal_availability(&self) -> (bool, bool) {
        (
            self.resolve_legal_resource(LEGAL_LICENSE_RESOURCE)
                .is_some(),
            self.resolve_legal_resource(LEGAL_THIRD_PARTY_RESOURCE)
                .is_some(),
        )
    }

    /// `read_legal_text` (contract command 34): reads the first bundled
    /// resource found in the resolution roots; a missing resource is the
    /// graceful `PS_IO_NOT_FOUND` path (the About page hides the action when
    /// `*Available` is false).
    pub fn read_legal_text(&self, kind: LegalTextKind) -> Result<LegalTextResult, AppError> {
        let resource_name = match kind {
            LegalTextKind::License => LEGAL_LICENSE_RESOURCE,
            LegalTextKind::ThirdPartyNotices => LEGAL_THIRD_PARTY_RESOURCE,
        };
        let path = self
            .resolve_legal_resource(resource_name)
            .ok_or_else(|| AppError::new(ErrorCode::IoNotFound))?;
        let text = fs::read_to_string(&path).map_err(AppError::from_io_read)?;
        Ok(LegalTextResult {
            text,
            resource_name: resource_name.to_owned(),
        })
    }
}

/// Repository root compiled into the binary, used only as a development
/// fallback: `AppState` appends it so direct `tauri dev`/`cargo run`
/// executions resolve the legal texts from the checkout when the bundler did
/// not stage them (debug builds only; a released binary never reads
/// build-machine paths).
pub fn dev_repo_root() -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    {
        option_env!("CARGO_MANIFEST_DIR").map(|manifest_dir| Path::new(manifest_dir).join(".."))
    }
    #[cfg(not(debug_assertions))]
    {
        None
    }
}

/// `os` field of `AppInfo`/`DiagnosticsBundle.app` (contracts §3.7): the
/// platform/architecture string, never a hostname or user name.
pub fn runtime_os() -> String {
    format!("{} {}", std::env::consts::OS, std::env::consts::ARCH)
}

/// `open_external_url` validation (contract command 31; R15): only `http` and
/// `https` URLs with a host pass. Everything else is
/// `PS_RESOURCE_UNSUPPORTED`. The caller opens the returned URL through the
/// pinned opener plugin; the command is only meaningful for user-initiated
/// clicks (contracts §8 `opener.openExternalUrl`).
pub fn validate_external_url(raw: &str) -> Result<Url, AppError> {
    let url = Url::parse(raw).map_err(|error| {
        AppError::new(ErrorCode::ResourceUnsupported)
            .with_message("external URL could not be parsed")
            .with_source(error)
    })?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        let mut details = crate::models::ErrorDetails::new();
        details.insert(
            "scheme".to_owned(),
            crate::models::DetailValue::String(url.scheme().to_owned()),
        );
        return Err(AppError::new(ErrorCode::ResourceUnsupported)
            .with_message("external URL must be http(s)")
            .with_details(details));
    }
    Ok(url)
}

/// `reveal_in_folder` resolution (contract command 32; R07/R09): the target is
/// canonicalized and must sit inside the current authorization set (an opened
/// document's file grant or an opened directory root). Unknown/missing targets
/// are `PS_IO_NOT_FOUND`; canonical targets without a grant are
/// `PS_AUTH_OUTSIDE_ROOT` (the registry is the only source of truth, a path
/// string is never a credential).
pub fn resolve_reveal_target<P: PathProbe + ?Sized>(
    probe: &P,
    auth: &AuthRegistry,
    raw: &str,
) -> Result<PathBuf, AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err(AppError::new(ErrorCode::IoNotFound));
    }
    let canonical = probe.canonicalize(Path::new(trimmed)).map_err(|error| {
        let code = match error.kind() {
            std::io::ErrorKind::PermissionDenied => ErrorCode::IoPermission,
            _ => ErrorCode::IoNotFound,
        };
        AppError::new(code).with_source(error)
    })?;
    if !auth.has_local_access(&canonical) {
        return Err(AppError::new(ErrorCode::AuthOutsideRoot));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_url_validation_accepts_only_http_and_https_with_host() {
        assert!(validate_external_url("https://example.com/docs?q=1").is_ok());
        assert!(validate_external_url("http://example.com").is_ok());
        assert_eq!(
            validate_external_url("file:///etc/passwd")
                .unwrap_err()
                .code(),
            ErrorCode::ResourceUnsupported
        );
        assert_eq!(
            validate_external_url("javascript:alert(1)")
                .unwrap_err()
                .code(),
            ErrorCode::ResourceUnsupported
        );
        assert!(validate_external_url("http://").is_err());
        assert_eq!(
            validate_external_url("not a url").unwrap_err().code(),
            ErrorCode::ResourceUnsupported
        );
    }

    #[test]
    fn app_info_is_contract_fixed_and_source_entry_is_explicitly_unconfigured() {
        let service = InfoService::new(PathBuf::from("/nonexistent/paperstack-resources"));
        let info = service.app_info();
        assert_eq!(info.name, "纸栈 PaperStack");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert_eq!(info.owner, "Quirkybrain");
        assert_eq!(info.license, "GPL-3.0-only");
        assert_eq!(info.ipc_contract, "paperstack-ipc-r1");
        assert_eq!(info.locale, "zh-CN");
        assert_eq!(info.tauri_version.as_deref(), Some(tauri::VERSION));
        assert!(info.legal.source_entry_url.is_none());
        assert_eq!(
            info.legal.source_entry_note.as_deref(),
            Some(SOURCE_ENTRY_NOTE_KEY)
        );
        assert!(!info.legal.license_available);
        assert!(!info.legal.third_party_available);
    }

    #[test]
    fn legal_text_resolution_prefers_the_resource_dir_and_falls_back_to_the_repo_root() {
        let bundled = tempfile::tempdir().unwrap();
        let repo_root = tempfile::tempdir().unwrap();
        fs::write(
            bundled.path().join(LEGAL_LICENSE_RESOURCE),
            "bundled GPL text",
        )
        .unwrap();
        fs::write(
            repo_root.path().join(LEGAL_THIRD_PARTY_RESOURCE),
            "dev notices text",
        )
        .unwrap();

        let service = InfoService::new(bundled.path()).with_fallback_dir(repo_root.path());
        assert_eq!(service.legal_availability(), (true, true));

        let license = service.read_legal_text(LegalTextKind::License).unwrap();
        assert_eq!(license.text, "bundled GPL text");
        assert_eq!(license.resource_name, LEGAL_LICENSE_RESOURCE);

        let notices = service
            .read_legal_text(LegalTextKind::ThirdPartyNotices)
            .unwrap();
        assert_eq!(notices.text, "dev notices text");
        assert_eq!(notices.resource_name, LEGAL_THIRD_PARTY_RESOURCE);
    }

    #[test]
    fn missing_legal_resource_is_a_graceful_not_found_error() {
        let empty = tempfile::tempdir().unwrap();
        let service = InfoService::new(empty.path());
        assert_eq!(service.legal_availability(), (false, false));
        let error = service.read_legal_text(LegalTextKind::License).unwrap_err();
        assert_eq!(error.code(), ErrorCode::IoNotFound);
        assert_eq!(
            InfoService::new(empty.path())
                .read_legal_text(LegalTextKind::ThirdPartyNotices)
                .unwrap_err()
                .code(),
            ErrorCode::IoNotFound
        );
    }
}
