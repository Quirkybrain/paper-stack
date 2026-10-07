//! PaperStack application entry point.
//!
//! wp-07 wired the window and the pinned plugin whitelist from ADR-001;
//! wp-08..wp-13 added the shared contract models, the stable error taxonomy
//! and the trusted Rust services; wp-14 adds the diagnostics/info services,
//! the managed [`state::AppState`] and the complete `paperstack-ipc-r1`
//! command surface (`commands::invoke_handler`).
//!
//! Plugin order follows security-model §6: the single-instance plugin is
//! registered first (Tauri requirement), then dialog, clipboard-manager and
//! opener. No fs/shell/http plugin is registered (PC-02).

pub mod commands;
pub mod error;
pub mod models;
pub mod services;
pub mod state;

use tauri::Manager;

/// Builds and runs the Tauri application.
pub fn run() {
    tauri::Builder::default()
        // The single-instance plugin must be registered before any other plugin.
        // Second-instance paths either join the startup queue or are delivered
        // as `paperstack://open-requested` (contracts §4).
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            state::handle_second_instance(app, args, cwd);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let managed = state::AppState::create(&handle);
            app.manage(managed);
            let state = handle.state::<state::AppState>();
            // Watch failures degrade `watch_document` to `PS_INTERNAL`; they
            // never stop startup.
            if let Err(error) = state.start_watch(&handle) {
                state.diagnostics.record_app_error(None, &error);
            }
            Ok(())
        })
        .invoke_handler(commands::invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running the PaperStack application");
}
