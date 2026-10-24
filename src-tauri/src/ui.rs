// Window management shared by commands, tray and hotkeys.
//
// Three windows (tauri.conf.json):
//   overlay  - small, transparent, always on top, click-through by default
//   panel    - dashboard, normal window, starts hidden
//   settings - settings, normal window, starts hidden
//
// Settings live in Rust; every change goes through update_settings(), which
// persists, re-applies the overlay layout and broadcasts "settings:changed"
// so all three webviews stay in sync.

use crate::{state::AppState, Overlay, UserSettings};
use std::sync::{atomic::Ordering, Arc};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition,
};

const BASE_W: f64 = 300.0;
const BASE_H: f64 = 214.0;
const SILENT_H: f64 = 46.0;
const CHIP: f64 = 44.0;
const MARGIN: f64 = 16.0;

pub fn show_window(app: &AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.unminimize();
        if label == "overlay" {
            let _ = w.set_always_on_top(true);
        } else {
            let _ = w.set_focus();
        }
    }
}

pub fn toggle_window(app: &AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let visible = w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false);
        if visible {
            let _ = w.hide();
        } else {
            show_window(app, label);
        }
    }
}

pub fn set_interactive(app: &AppHandle, on: bool) {
    let state = app.state::<Arc<AppState>>();
    state.interactive.store(on, Ordering::Relaxed);
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_ignore_cursor_events(!on);
    }
    let _ = app.emit("overlay:interactive", on);
    tracing::info!("overlay interactive = {on}");
}

pub fn toggle_interactive(app: &AppHandle) {
    let on = app.state::<Arc<AppState>>().interactive.load(Ordering::Relaxed);
    set_interactive(app, !on);
}

pub fn update_settings(app: &AppHandle, f: impl FnOnce(&mut UserSettings)) -> anyhow::Result<()> {
    let state = app.state::<Arc<AppState>>();
    let (prev, next) = {
        let mut s = state.settings.write();
        let prev = s.overlay.clone();
        f(&mut s);
        (prev, s.clone())
    };
    state.persist_settings()?;
    if layout_changed(&prev, &next.overlay) {
        apply_overlay_layout(app, Some(&prev), &next.overlay);
    }
    let _ = app.emit("settings:changed", next);
    Ok(())
}

fn layout_changed(a: &Overlay, b: &Overlay) -> bool {
    a.scale != b.scale || a.corner != b.corner || a.minimized != b.minimized || a.silent != b.silent
}

fn overlay_size(o: &Overlay) -> (f64, f64) {
    let s = o.scale.clamp(0.6, 1.6);
    if o.minimized {
        (CHIP, CHIP)
    } else if o.silent {
        (BASE_W * s, SILENT_H * s)
    } else {
        (BASE_W * s, BASE_H * s)
    }
}

/// Resize the overlay for scale / minimized / silent. When the corner setting
/// changes (or on startup) snap to that screen corner; otherwise keep the
/// anchored corner where the user left it, so a dragged overlay stays put.
pub fn apply_overlay_layout(app: &AppHandle, prev: Option<&Overlay>, next: &Overlay) {
    let Some(win) = app.get_webview_window("overlay") else { return };
    let (w, h) = overlay_size(next);
    let sf = win.scale_factor().unwrap_or(1.0);
    let new_w = (w * sf).round() as i32;
    let new_h = (h * sf).round() as i32;
    let old_pos = win.outer_position().ok();
    let old_size = win.outer_size().ok();
    let _ = win.set_size(LogicalSize::new(w, h));

    let snap = prev.map(|p| p.corner != next.corner).unwrap_or(true);
    if snap {
        if let Ok(Some(m)) = win.current_monitor() {
            let mp = m.position();
            let ms = m.size();
            let margin = (MARGIN * sf).round() as i32;
            let right = mp.x + ms.width as i32 - new_w - margin;
            let bottom = mp.y + ms.height as i32 - new_h - margin;
            let (x, y) = match next.corner.as_str() {
                "top-right" => (right, mp.y + margin),
                "bottom-left" => (mp.x + margin, bottom),
                "bottom-right" => (right, bottom),
                _ => (mp.x + margin, mp.y + margin),
            };
            let _ = win.set_position(PhysicalPosition::new(x, y));
        }
    } else if let (Some(p), Some(sz)) = (old_pos, old_size) {
        let dx = sz.width as i32 - new_w;
        let dy = sz.height as i32 - new_h;
        let (x, y) = match next.corner.as_str() {
            "top-right" => (p.x + dx, p.y),
            "bottom-left" => (p.x, p.y + dy),
            "bottom-right" => (p.x + dx, p.y + dy),
            _ => (p.x, p.y),
        };
        if dx != 0 || dy != 0 {
            let _ = win.set_position(PhysicalPosition::new(x, y));
        }
    }
}

pub fn play_sound() {
    #[cfg(windows)]
    unsafe {
        use windows::Win32::System::Diagnostics::Debug::MessageBeep;
        use windows::Win32::UI::WindowsAndMessaging::MB_ICONASTERISK;
        let _ = MessageBeep(MB_ICONASTERISK);
    }
}

pub fn install_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("overlay_show", "Mostrar").build(app)?;
    let hide = MenuItemBuilder::with_id("overlay_hide", "Ocultar").build(app)?;
    let overlay = SubmenuBuilder::new(app, "Overlay").items(&[&show, &hide]).build()?;
    let panel = MenuItemBuilder::with_id("panel", "Abrir Painel").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Configurações").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Sair").build(app)?;
    let menu = MenuBuilder::new(app)
        .items(&[&overlay, &panel, &settings])
        .separator()
        .item(&quit)
        .build()?;

    let icon = app.default_window_icon().cloned().unwrap_or_else(|| {
        tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("embedded tray icon")
    });

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("LoL Coach")
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "overlay_show" => show_window(app, "overlay"),
                "overlay_hide" => {
                    if let Some(w) = app.get_webview_window("overlay") {
                        let _ = w.hide();
                    }
                }
                "panel" => show_window(app, "panel"),
                "settings" => show_window(app, "settings"),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .build(app)?;
    Ok(())
}
