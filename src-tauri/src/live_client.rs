// Live Client Data API poller.
//
// Riot runs a read-only JSON endpoint during an active match at:
//     https://127.0.0.1:2999/liveclientdata/allgamedata
// Self-signed cert; endpoint is officially supported for third-party overlays
// (StreamOverlay, HLSL overlays). It is READ-ONLY: there is no shop endpoint,
// no spell cast, no movement. Any "auto-buy" is a separate concern (see
// auto_buy.rs for the honest story).

use crate::state::AppState;
use serde_json::Value;
use std::{sync::Arc, time::Duration};
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

const URL: &str = "https://127.0.0.1:2999/liveclientdata/allgamedata";
const POLL_MS: u64 = 1000;

pub async fn run_poller(state: Arc<AppState>, app: AppHandle) {
    let http = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(Duration::from_millis(900))
        .build()
        .expect("http client");

    let mut was_in_game = false;
    let mut last_event_count: usize = 0;

    loop {
        match http.get(URL).send().await {
            Ok(r) if r.status().is_success() => {
                if let Ok(text) = r.text().await {
                    if let Ok(v) = serde_json::from_str::<Value>(&text) {
                        if !was_in_game {
                            let _ = app.emit("ingame:start", true);
                            was_in_game = true;
                        }
                        // Diff events.
                        if let Some(events) = v
                            .get("events")
                            .and_then(|e| e.get("Events"))
                            .and_then(|e| e.as_array())
                        {
                            if events.len() > last_event_count {
                                for ev in &events[last_event_count..] {
                                    let _ = app.emit("ingame:event", ev.clone());
                                }
                                last_event_count = events.len();
                            }
                        }
                        *state.live_snapshot.write() = Some(v.clone());
                        let _ = app.emit("ingame:snapshot", v);
                    }
                }
            }
            _ => {
                if was_in_game {
                    was_in_game = false;
                    last_event_count = 0;
                    *state.live_snapshot.write() = None;
                    let _ = app.emit("ingame:end", true);
                }
            }
        }
        sleep(Duration::from_millis(POLL_MS)).await;
    }
}
