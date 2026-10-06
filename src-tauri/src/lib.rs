//! PaperStack application entry point.
//!
//! The skeleton (wp-07) wires the window and the pinned plugin set from
//! ADR-001. wp-08 adds the shared contract models, the stable error taxonomy
//! and the authorization core (`paths`/`auth`); the IPC command surface and
//! the remaining services are added by wp-09..wp-15.

pub mod error;
pub mod models;
pub mod services;

/// Builds and runs the Tauri application.
pub fn run() {
    tauri::Builder::default()
        // The single-instance plugin must be registered before any other plugin.
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {}))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running the PaperStack application");
}
