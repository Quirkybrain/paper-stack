//! Contract models for global settings (contracts §3.5; defaults frozen by
//! data-model §5).

use serde::{Deserialize, Serialize};

/// `GlobalSettings.theme` (default `system`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    System,
    Light,
    Dark,
}

/// `GlobalSettings.syntaxMode` (default `technical`, R08).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SyntaxMode {
    Technical,
    Standard,
}

/// `GlobalSettings.updateModeDefault` (default `keep`, R21).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UpdateMode {
    Keep,
    Follow,
}

/// Persistent global settings (contracts §3.5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    pub theme: Theme,
    pub font_size_px: u32,
    pub line_height: f64,
    pub max_content_width_px: u32,
    pub syntax_mode: SyntaxMode,
    pub update_mode_default: UpdateMode,
    pub restore_session: bool,
    pub remember_records: bool,
}

impl Default for GlobalSettings {
    fn default() -> Self {
        Self {
            theme: Theme::System,
            font_size_px: 17,
            line_height: 1.8,
            max_content_width_px: 760,
            syntax_mode: SyntaxMode::Technical,
            update_mode_default: UpdateMode::Keep,
            restore_session: true,
            remember_records: true,
        }
    }
}

/// Frozen v0.1.0 limits (SRS §6.1): 100 recents / 256 MiB cache / 10 MiB logs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrozenLimits {
    pub recent_limit: u64,
    pub cache_max_bytes: u64,
    pub log_max_bytes: u64,
}

impl Default for FrozenLimits {
    fn default() -> Self {
        Self {
            recent_limit: 100,
            cache_max_bytes: 256 * 1024 * 1024,
            log_max_bytes: 10 * 1024 * 1024,
        }
    }
}

/// `get_settings` response (contracts §3.5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsBundle {
    pub global: GlobalSettings,
    pub defaults: GlobalSettings,
    pub limits: FrozenLimits,
    pub revision: u64,
}

/// `Partial<GlobalSettings>` patch; absent fields keep their current value
/// (R23).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettingsPatch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<Theme>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub font_size_px: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_height: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_content_width_px: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub syntax_mode: Option<SyntaxMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update_mode_default: Option<UpdateMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub restore_session: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remember_records: Option<bool>,
}

/// `update_settings` request (contracts §3.5).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsRequest {
    pub patch: GlobalSettingsPatch,
}

/// `update_settings` response: `applied` is in-memory, `persisted` reports the
/// database write (contracts §2.1; R23).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsResult {
    pub applied: GlobalSettings,
    pub persisted: bool,
    pub revision: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<super::diagnostics::ErrorPayload>,
}
