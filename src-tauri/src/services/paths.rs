//! Local path authorization — mandatory order from `security-model.md` §2.2.
//!
//! The algorithm is pure with respect to a [`PathProbe`] so every branch,
//! including the TOCTOU re-check, is unit-testable with scripted resolutions.

use std::io;
use std::path::{Component, Path, PathBuf};

use crate::error::{AppError, ErrorCode};
use crate::models::{DetailValue, ErrorDetails, GrantKind, GrantRecord};

/// Filesystem capabilities used by the authorization algorithm. Production
/// uses [`SystemPathProbe`]; tests inject scripted probes.
pub trait PathProbe {
    /// Step 6: does the target exist (symlinks followed)?
    fn exists(&self, path: &Path) -> bool;
    /// Step 7: canonicalize, fully resolving symlinks.
    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf>;
    /// Startup grant revalidation: can the process read this path?
    fn is_readable(&self, path: &Path) -> bool;
}

/// Real-filesystem probe. Linux-first: opening a directory read-only succeeds,
/// so `is_readable` covers files and directories alike.
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemPathProbe;

impl PathProbe for SystemPathProbe {
    fn exists(&self, path: &Path) -> bool {
        path.exists()
    }

    fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
        std::fs::canonicalize(path)
    }

    fn is_readable(&self, path: &Path) -> bool {
        std::fs::File::open(path).is_ok()
    }
}

/// Result of steps 1–3: the reference is either local (with the decoded text)
/// or http/https and must be handled by the remote policy (security-model §4).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ReferenceClass {
    Local(String),
    Remote(String),
}

/// Result of the full `authorize_local_read` algorithm.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LocalReadOutcome {
    Authorized(AuthorizedRead),
    /// http/https reference: not an error, the caller applies the remote
    /// policy (step 2).
    Remote {
        raw_ref: String,
    },
}

/// A canonical target that passed authorization.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthorizedRead {
    pub canonical_path: PathBuf,
    /// `grantId` of the most specific matching grant.
    pub grant_id: String,
}

/// Steps 1–3: empty/NUL rejection, scheme routing, URL-necessary percent
/// decoding with a re-check of step 1 (security-model §2.2).
pub fn classify_reference(raw_ref: &str) -> Result<ReferenceClass, AppError> {
    ensure_usable(raw_ref)?;
    if let Some(scheme) = detect_scheme(raw_ref) {
        if scheme.eq_ignore_ascii_case("http") || scheme.eq_ignore_ascii_case("https") {
            return Ok(ReferenceClass::Remote(raw_ref.to_owned()));
        }
        return Err(unsupported_scheme(scheme));
    }
    let decoded = percent_decode(raw_ref)?;
    ensure_usable(&decoded)?;
    Ok(ReferenceClass::Local(decoded))
}

/// Full local authorization flow. `base_dir` is the requesting document's
/// canonical parent directory supplied by the Rust registry — never by the UI
/// (step 4). `grants` are the effective (available) file/directory grants.
pub fn authorize_local_read<P: PathProbe + ?Sized>(
    probe: &P,
    base_dir: &Path,
    raw_ref: &str,
    grants: &[GrantRecord],
) -> Result<LocalReadOutcome, AppError> {
    let decoded = match classify_reference(raw_ref)? {
        ReferenceClass::Local(decoded) => decoded,
        ReferenceClass::Remote(raw_ref) => return Ok(LocalReadOutcome::Remote { raw_ref }),
    };
    // Step 5: join relative references against the registry-provided base and
    // lexically clean `.`/`..` (the only place `..` is resolved lexically).
    let target = resolve_reference(base_dir, &decoded);

    // Steps 6–9, retried once when the canonical target changes between the
    // authorization decision and the asset-scope grant (TOCTOU narrowing).
    for _attempt in 0..2 {
        let canonical = match canonical_target(probe, &target)? {
            CanonicalTarget::Existing(canonical) => canonical,
            CanonicalTarget::Missing { nearest_existing } => {
                return Err(missing_target_error(grants, &target, &nearest_existing));
            }
        };
        let Some(grant) = matching_grant(grants, &canonical) else {
            return Err(outside_root_parent(&canonical));
        };
        match canonical_target(probe, &target)? {
            // Re-canonicalize before granting the asset scope (step 9). Only a
            // stable result may be authorized.
            CanonicalTarget::Existing(recheck) if recheck == canonical => {
                return Ok(LocalReadOutcome::Authorized(AuthorizedRead {
                    canonical_path: canonical,
                    grant_id: grant.grant_id.clone(),
                }));
            }
            // Changed (or vanished) since the decision: retry once from step 4.
            _ => {}
        }
    }
    Err(AppError::new(ErrorCode::IoChanged))
}

/// Most specific grant authorizing `target`, if any (component-level matching
/// via `Path::starts_with`; string prefixes are never used).
pub fn matching_grant<'a>(grants: &'a [GrantRecord], target: &Path) -> Option<&'a GrantRecord> {
    grants
        .iter()
        .filter(|grant| grant_matches(grant, target))
        .max_by_key(|grant| grant.canonical_path.as_ref().map_or(0, String::len))
}

/// Component-level "is `target` at or below `root`" check (case-sensitive on
/// Linux; only extension checks ignore case, R01).
pub fn is_within_root(root: &Path, target: &Path) -> bool {
    target == root || target.starts_with(root)
}

/// Joins a decoded reference against `base_dir` (absolute references are kept)
/// and applies lexical cleanup of `.` and `..` (step 5).
pub fn resolve_reference(base_dir: &Path, decoded: &str) -> PathBuf {
    let joined = if Path::new(decoded).is_absolute() {
        PathBuf::from(decoded)
    } else {
        base_dir.join(decoded)
    };
    lexical_cleanup(&joined)
}

/// Lexical component cleanup. `..` inside the root stays legal and is resolved
/// here; `..` above `/` is dropped (POSIX `/..` == `/`).
pub fn lexical_cleanup(path: &Path) -> PathBuf {
    let mut cleaned: Vec<Component<'_>> = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => match cleaned.last() {
                Some(Component::Normal(_)) => {
                    cleaned.pop();
                }
                Some(Component::ParentDir) => cleaned.push(component),
                Some(Component::RootDir) | Some(Component::Prefix(_)) => {}
                Some(Component::CurDir) => {}
                None => cleaned.push(component),
            },
            _ => cleaned.push(component),
        }
    }
    cleaned
        .iter()
        .map(|component| component.as_os_str())
        .collect()
}

/// URL-necessary percent decoding (step 3): valid `%XX` sequences are decoded;
/// malformed sequences stay literal. Invalid UTF-8 results are rejected by the
/// step 1 re-check.
pub fn percent_decode(input: &str) -> Result<String, AppError> {
    let bytes = input.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            if let (Some(high), Some(low)) =
                (hex_value(bytes[index + 1]), hex_value(bytes[index + 2]))
            {
                decoded.push(high * 16 + low);
                index += 3;
                continue;
            }
        }
        decoded.push(bytes[index]);
        index += 1;
    }
    String::from_utf8(decoded).map_err(|_| AppError::new(ErrorCode::IoNotFound))
}

/// Extension check ignores case (R01); path comparison never does.
pub fn has_markdown_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("markdown")
        })
}

/// RFC 3986-ish scheme detection limited to what `rawRef` classification
/// needs: ASCII alpha, then alpha/digit/`+`/`-`/`.` up to `:`.
pub fn detect_scheme(raw_ref: &str) -> Option<&str> {
    let mut characters = raw_ref.char_indices();
    let (_, first) = characters.next()?;
    if !first.is_ascii_alphabetic() {
        return None;
    }
    for (index, character) in characters {
        match character {
            ':' => return Some(&raw_ref[..index]),
            _ if character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.') => {}
            _ => return None,
        }
    }
    None
}

enum CanonicalTarget {
    Existing(PathBuf),
    Missing { nearest_existing: PathBuf },
}

fn ensure_usable(value: &str) -> Result<(), AppError> {
    if value.is_empty() || value.contains('\0') {
        Err(AppError::new(ErrorCode::IoNotFound))
    } else {
        Ok(())
    }
}

fn canonical_target<P: PathProbe + ?Sized>(
    probe: &P,
    target: &Path,
) -> Result<CanonicalTarget, AppError> {
    if probe.exists(target) {
        return probe
            .canonicalize(target)
            .map(CanonicalTarget::Existing)
            .map_err(map_resolution_error);
    }
    // Step 6: canonicalize the nearest existing ancestor and still judge it
    // against the grant set (no extra leakage between in-root/out-of-root
    // missing targets — UI text is unified).
    let mut ancestor = target.parent();
    while let Some(path) = ancestor {
        if probe.exists(path) {
            let canonical = probe.canonicalize(path).map_err(map_resolution_error)?;
            return Ok(CanonicalTarget::Missing {
                nearest_existing: canonical,
            });
        }
        ancestor = path.parent();
    }
    Err(AppError::new(ErrorCode::IoNotFound))
}

fn missing_target_error(
    grants: &[GrantRecord],
    target: &Path,
    nearest_existing: &Path,
) -> AppError {
    let granted_as_file = grants.iter().any(|grant| {
        grant.kind == GrantKind::File
            && grant.canonical_path.as_deref().map(Path::new) == Some(target)
    });
    if granted_as_file || matching_grant(grants, nearest_existing).is_some() {
        AppError::new(ErrorCode::ResourceMissing)
    } else {
        outside_root(nearest_existing)
    }
}

fn grant_matches(grant: &GrantRecord, target: &Path) -> bool {
    match grant.kind {
        GrantKind::File => grant.canonical_path.as_deref().map(Path::new) == Some(target),
        GrantKind::Directory => grant
            .canonical_path
            .as_deref()
            .map(Path::new)
            .is_some_and(|root| is_within_root(root, target)),
        GrantKind::Remote => false,
    }
}

fn map_resolution_error(error: io::Error) -> AppError {
    match error.kind() {
        io::ErrorKind::PermissionDenied => AppError::new(ErrorCode::IoPermission),
        // NotFound and unresolvable chains (symlink loops etc.) both end as
        // PS_IO_NOT_FOUND per step 7.
        _ => AppError::new(ErrorCode::IoNotFound),
    }
    .with_source(error)
}

fn outside_root(root_candidate: &Path) -> AppError {
    let mut details = ErrorDetails::new();
    details.insert(
        "rootCandidate".to_owned(),
        DetailValue::String(root_candidate.to_string_lossy().into_owned()),
    );
    AppError::new(ErrorCode::AuthOutsideRoot).with_details(details)
}

/// Step 10: the suggested directory to grant is the canonical target's parent.
fn outside_root_parent(target: &Path) -> AppError {
    match target.parent() {
        Some(parent) => outside_root(parent),
        None => outside_root(target),
    }
}

fn unsupported_scheme(scheme: &str) -> AppError {
    let mut details = ErrorDetails::new();
    details.insert("scheme".to_owned(), DetailValue::String(scheme.to_owned()));
    AppError::new(ErrorCode::ResourceUnsupported).with_details(details)
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_decode_handles_valid_and_malformed_sequences() {
        assert_eq!(percent_decode("%2e%2e/a%20b.md").unwrap(), "../a b.md");
        assert_eq!(percent_decode("%E4%B8%AD.md").unwrap(), "中.md");
        assert_eq!(percent_decode("100%.md").unwrap(), "100%.md");
        assert_eq!(percent_decode("%zz.md").unwrap(), "%zz.md");
        assert_eq!(percent_decode("%2.md").unwrap(), "%2.md");
    }

    #[test]
    fn percent_decode_rejects_invalid_utf8() {
        let error = percent_decode("%FF%FE").unwrap_err();
        assert_eq!(error.code(), ErrorCode::IoNotFound);
    }

    #[test]
    fn scheme_detection_distinguishes_paths_and_urls() {
        assert_eq!(detect_scheme("https://example.com/a.png"), Some("https"));
        assert_eq!(detect_scheme("javascript:alert(1)"), Some("javascript"));
        assert_eq!(detect_scheme("./img/a.png"), None);
        assert_eq!(detect_scheme("/home/user/a.png"), None);
        assert_eq!(detect_scheme("notes:2026.md"), Some("notes"));
        assert_eq!(detect_scheme("1st:file"), None);
    }

    #[test]
    fn lexical_cleanup_resolves_dot_and_dot_dot_at_component_level() {
        assert_eq!(
            lexical_cleanup(Path::new("/root/sub/../a.md")),
            PathBuf::from("/root/a.md")
        );
        assert_eq!(
            lexical_cleanup(Path::new("/root/./sub//a.md")),
            PathBuf::from("/root/sub/a.md")
        );
        assert_eq!(
            lexical_cleanup(Path::new("/../../etc/passwd")),
            PathBuf::from("/etc/passwd")
        );
        assert_eq!(
            lexical_cleanup(Path::new("a/../../b")),
            PathBuf::from("../b")
        );
    }

    #[test]
    fn markdown_extension_check_ignores_case_only() {
        assert!(has_markdown_extension(Path::new("README.MD")));
        assert!(has_markdown_extension(Path::new("a.markdown")));
        assert!(has_markdown_extension(Path::new("a.MarkDown")));
        assert!(!has_markdown_extension(Path::new("a.txt")));
        assert!(!has_markdown_extension(Path::new("md")));
    }

    #[test]
    fn is_within_root_is_component_level_and_case_sensitive() {
        assert!(is_within_root(Path::new("/root"), Path::new("/root")));
        assert!(is_within_root(
            Path::new("/root"),
            Path::new("/root/a/b.md")
        ));
        assert!(!is_within_root(Path::new("/root"), Path::new("/rooted/a")));
        assert!(!is_within_root(Path::new("/Root"), Path::new("/root/a")));
    }
}
