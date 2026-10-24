// Global hotkeys (GetAsyncKeyState polling, 50ms).
//
//   F1 or Ctrl+F1  overlay interactive on/off (click-through)
//   F2 / F3        overlay view: item / draft
//   F4             silent mode
//   F6             minimize / expand the overlay (chip <-> widget)
//   Ctrl+Shift+O   open / close the panel
//
// Plain F2-F4 are only taken when Ctrl and Shift are up. Note: League binds
// F1-F5 to camera-on-ally by default, so these also move the game camera.

use tauri::AppHandle;

#[cfg(windows)]
pub async fn install(app: AppHandle) {
    use crate::ui;
    use std::time::Duration;
    use tauri::Emitter;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_CONTROL, VK_F1, VK_F2, VK_F3, VK_F4, VK_F6, VK_SHIFT,
    };
    const VK_O: i32 = 0x4F;

    fn down(vk: i32) -> bool {
        unsafe { (GetAsyncKeyState(vk) as u16 & 0x8000) != 0 }
    }

    let mut prev = [false; 6];
    loop {
        let ctrl = down(VK_CONTROL.0 as i32);
        let shift = down(VK_SHIFT.0 as i32);
        let plain = !ctrl && !shift;
        let now = [
            // F1 and Ctrl+F1 both toggle interactive (Shift+F1 ignored).
            !shift && down(VK_F1.0 as i32),
            plain && down(VK_F2.0 as i32),
            plain && down(VK_F3.0 as i32),
            plain && down(VK_F4.0 as i32),
            plain && down(VK_F6.0 as i32),
            ctrl && shift && down(VK_O),
        ];
        for i in 0..now.len() {
            if now[i] && !prev[i] {
                match i {
                    0 => ui::toggle_interactive(&app),
                    1 => {
                        let _ = app.emit("hotkey", "F2");
                    }
                    2 => {
                        let _ = app.emit("hotkey", "F3");
                    }
                    3 => {
                        let _ = ui::update_settings(&app, |s| s.overlay.silent = !s.overlay.silent);
                    }
                    4 => {
                        let _ = ui::update_settings(&app, |s| s.overlay.minimized = !s.overlay.minimized);
                    }
                    _ => ui::toggle_window(&app, "panel"),
                }
            }
            prev[i] = now[i];
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

#[cfg(not(windows))]
pub async fn install(_app: AppHandle) {}
