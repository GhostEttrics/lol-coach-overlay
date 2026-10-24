// Auto-buy — the honest story.
//
// There is NO official endpoint that purchases items in-game. The Live Client
// Data API on 2999 is read-only; the LCU API covers client/lobby, not the match.
// The shop lives in the League of Legends.exe game process, and all legitimate
// paths to drive it from outside require one of:
//
//     1. SendInput / keyboard automation into the game window
//        -> Vanguard detects foreign input injection into protected processes
//           and bans the account. Reversible purchase or not: it is NOT a safe
//           action, because it is input simulation into a protected process.
//
//     2. Writing to game memory to call shop RPCs directly
//        -> Vanguard reads the game's memory and blocks external writes. Ban.
//
//     3. Hooking the game's own shop function via DLL injection
//        -> Vanguard blocks module injection into game processes. Ban.
//
// There is no fourth path. Every "auto-buy for LoL" out there uses one of the
// three, and every one of them is a bannable action under Vanguard.
//
// What this file does: it opens the shop via SendInput (`P`) when the League
// game window is in the foreground. It is wired behind a toggle that is OFF
// by default and gated by an "I understand the risk" acknowledgment.
//
// Honest default: leave auto_buy OFF. The overlay highlights the recommended
// item with a green pulse when you're in base — you click, no injection.

#[cfg(windows)]
pub async fn try_buy(item_id: u32) -> anyhow::Result<bool> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT,
        KEYEVENTF_KEYUP, VK_P,
    };
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, GetForegroundWindow};

    // Only act when the League *game* window is in the foreground. Window title
    // of the game process (not the client/lobby).
    let wide: Vec<u16> = "League of Legends (TM) Client\0".encode_utf16().collect();
    let hwnd = unsafe { FindWindowW(PCWSTR::null(), PCWSTR(wide.as_ptr())) };
    let hwnd = match hwnd {
        Ok(h) if !h.is_invalid() => h,
        _ => return Ok(false),
    };
    let fg = unsafe { GetForegroundWindow() };
    if fg != hwnd {
        return Ok(false);
    }

    let down = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VK_P,
                wScan: 0,
                dwFlags: KEYBD_EVENT_FLAGS(0),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let up = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VK_P,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[down, up], std::mem::size_of::<INPUT>() as i32);
    }

    tracing::warn!(
        "auto-buy fired for item {item_id}. SendInput into a protected process = Vanguard bannable."
    );
    Ok(true)
}

#[cfg(not(windows))]
pub async fn try_buy(_item_id: u32) -> anyhow::Result<bool> {
    Ok(false)
}
