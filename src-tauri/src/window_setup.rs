// Platform-specific window plumbing.
//
// On Windows, applying `WS_EX_NOACTIVATE` to the overlay makes a click on the
// overlay NOT change the foreground window. The overlay still receives the
// click (buttons work, drag works), but the game stays active and keeps the
// keyboard. Combined with WS_EX_TOOLWINDOW this also hides it from Alt-Tab.
//
// Also adds WS_EX_LAYERED (should already be on for transparent) just to be
// safe — some drivers behave oddly without it on top-level transparent windows.

#[cfg(windows)]
pub fn apply_overlay_window_styles<R: tauri::Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> anyhow::Result<()> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_LAYERED, WS_EX_NOACTIVATE,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
    };

    // `window.hwnd()` comes from Tauri's `windows` crate (currently 0.62);
    // this crate pins 0.58. Both HWND types are a raw pointer newtype.
    let hwnd = HWND(window.hwnd()?.0);
    unsafe {
        let cur = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let add =
            (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0 | WS_EX_LAYERED.0 | WS_EX_TOPMOST.0) as isize;
        let new_ex = cur | add;
        if new_ex != cur {
            SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_ex);
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn apply_overlay_window_styles<R: tauri::Runtime>(
    _window: &tauri::WebviewWindow<R>,
) -> anyhow::Result<()> {
    Ok(())
}
