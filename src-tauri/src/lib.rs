//! PaperStack application entry point.
//!
//! The skeleton (wp-07) only wires the window and the pinned plugin set from
//! ADR-001. The IPC command surface, state and services are added by wp-08..wp-15.

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
