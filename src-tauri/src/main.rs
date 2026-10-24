#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auto_buy;
mod data_dragon;
mod hotkeys;
mod lcu;
mod live_client;
mod state;
mod ui;
mod window_setup;

use serde::{Deserialize, Serialize};
use state::AppState;
use std::sync::Arc;
use tauri::{Manager, WindowEvent};

// serde(default) everywhere: a settings.json written by an older build must
// load, not reset.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct UserSettings {
    pub theme: String,
    pub lang: String,
    pub detail_level: String,
    pub pool: serde_json::Value,
    pub automation: Automation,
    pub overlay: Overlay,
    pub last_role: Option<String>,
    // Panel card id -> enabled. Missing id = enabled.
    pub panel_cards: serde_json::Value,
    pub notify: Notify,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            lang: "pt-BR".into(),
            detail_level: "medium".into(),
            pool: serde_json::json!({}),
            automation: Automation::default(),
            overlay: Overlay::default(),
            last_role: None,
            panel_cards: serde_json::json!({}),
            notify: Notify::default(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Automation {
    pub auto_accept: bool,
    pub auto_import_runes: bool,
    pub auto_buy: bool,
    pub elo_filter: Option<String>,
    pub queue_timeout_s: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(default)]
pub struct Overlay {
    pub click_through: bool,
    pub position: Option<(i32, i32)>,
    pub minimized: bool,
    pub silent: bool,
    pub scale: f64,
    pub corner: String, // top-left | top-right | bottom-left | bottom-right
}

impl Default for Overlay {
    fn default() -> Self {
        Self {
            click_through: true,
            position: None,
            minimized: false,
            silent: false,
            scale: 1.0,
            corner: "top-left".into(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(default)]
pub struct Notify {
    pub sound_affordable: bool,
    pub voice: bool,
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, Arc<AppState>>) -> Result<UserSettings, String> {
    Ok(state.settings.read().clone())
}

#[tauri::command]
async fn save_settings(app: tauri::AppHandle, settings: UserSettings) -> Result<(), String> {
    ui::update_settings(&app, |s| *s = settings).map_err(|e| e.to_string())
}

/// Click-through always targets the overlay, whichever window calls it.
#[tauri::command]
async fn set_click_through(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    ui::set_interactive(&app, !enabled);
    Ok(())
}

#[tauri::command]
async fn open_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    ui::show_window(&app, &label);
    Ok(())
}

#[tauri::command]
async fn toggle_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    ui::toggle_window(&app, &label);
    Ok(())
}

#[tauri::command]
async fn get_interactive(state: tauri::State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(state.interactive.load(std::sync::atomic::Ordering::Relaxed))
}

#[tauri::command]
fn play_sound() {
    ui::play_sound();
}

#[tauri::command]
fn get_log_path() -> String {
    log_dir().join("app.log").display().to_string()
}

#[tauri::command]
async fn get_patch_data(state: tauri::State<'_, Arc<AppState>>) -> Result<serde_json::Value, String> {
    let lang = state.settings.read().lang.clone();
    let lcu = state.lcu.read().clone();
    let game_version = match lcu {
        Some(c) => c.game_version().await,
        None => None,
    };
    state
        .data_dragon
        .load_or_fetch(&lang, game_version.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn request_auto_buy(state: tauri::State<'_, Arc<AppState>>, item_id: u32) -> Result<bool, String> {
    if !state.settings.read().automation.auto_buy {
        return Ok(false);
    }
    auto_buy::try_buy(item_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn import_runes(state: tauri::State<'_, Arc<AppState>>, page: serde_json::Value) -> Result<bool, String> {
    let lcu = state.lcu.read().clone();
    if let Some(client) = lcu {
        client.import_rune_page(page).await.map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
async fn import_item_build(state: tauri::State<'_, Arc<AppState>>, build: serde_json::Value) -> Result<bool, String> {
    let lcu = state.lcu.read().clone();
    if let Some(client) = lcu {
        client.import_item_build(build).await.map_err(|e| e.to_string())?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
async fn get_champ_select(state: tauri::State<'_, Arc<AppState>>) -> Result<Option<lcu::ChampSelectView>, String> {
    let client = match state.lcu.read().clone() {
        Some(c) => c,
        None => return Ok(None),
    };
    match client.champ_select_session().await {
        Ok(session) => Ok(lcu::LcuClient::parse_champ_select(&session)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
async fn get_item_sets(
    state: tauri::State<'_, Arc<AppState>>,
    champion: String,
    champion_key: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let lcu = state.lcu.read().clone();
    match lcu {
        Some(c) => Ok(c.item_sets(&champion, champion_key).await),
        None => Ok(vec![]),
    }
}

#[tauri::command]
fn log_engine(line: String) {
    tracing::info!(target: "engine", "{line}");
}

fn log_dir() -> std::path::PathBuf {
    dirs::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("dev.nyx.lolcoachoverlay")
        .join("logs")
}

fn main() {
    use tracing_subscriber::{fmt, prelude::*, EnvFilter};
    let dir = log_dir();
    let _ = std::fs::create_dir_all(&dir);
    let (file_writer, _log_guard) =
        tracing_appender::non_blocking(tracing_appender::rolling::never(&dir, "app.log"));
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,lol_coach_overlay=debug,engine=info")),
        )
        .with(fmt::layer())
        .with(fmt::layer().with_ansi(false).with_writer(file_writer))
        .init();
    tracing::info!("log file: {}", dir.join("app.log").display());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // Panel and settings hide on close so the tray can reopen them.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "overlay" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            let state = Arc::new(AppState::load(app.handle().clone())?);
            app.manage(state.clone());

            if let Some(win) = app.get_webview_window("overlay") {
                if let Err(e) = window_setup::apply_overlay_window_styles(&win) {
                    tracing::warn!("overlay window style setup failed: {e}");
                }
                let _ = win.set_ignore_cursor_events(true);
                let _ = win.set_always_on_top(true);
                #[cfg(debug_assertions)]
                win.close_devtools();
            }
            let overlay_cfg = state.settings.read().overlay.clone();
            ui::apply_overlay_layout(app.handle(), None, &overlay_cfg);

            if let Err(e) = ui::install_tray(app) {
                tracing::warn!("tray install failed: {e}");
            }

            let s = state.clone();
            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move { lcu::run_watcher(s, h).await });

            let s = state.clone();
            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move { live_client::run_poller(s, h).await });

            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move { hotkeys::install(h).await });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            set_click_through,
            open_window,
            toggle_window,
            get_interactive,
            play_sound,
            get_log_path,
            get_patch_data,
            request_auto_buy,
            import_runes,
            import_item_build,
            get_champ_select,
            get_item_sets,
            log_engine
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
