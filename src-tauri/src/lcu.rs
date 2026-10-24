// LCU (League Client Update) integration.
//
// The League client ships a local REST+WebSocket server. Credentials live in
// `lockfile` under the install path, written when the client starts:
//     LeagueClient:<pid>:<port>:<password>:<protocol>
// Basic auth is "riot:<password>", TLS is self-signed, so we disable verification
// for 127.0.0.1 only.
//
// This module:
//   - watches lockfile location,
//   - exposes auto-accept (/lol-matchmaking/v1/ready-check/accept),
//   - exposes rune page import (/lol-perks/v1/pages),
//   - exposes item build import (writes a Blitz-style ItemSet into the install's
//     Config/Champions folder; non-destructive),
//   - polls /lol-champ-select/v1/session during draft and emits a parsed view
//     to the frontend as "champselect:update".

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{path::PathBuf, sync::Arc, time::Duration};
use sysinfo::System;
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

use crate::state::AppState;

#[derive(Clone)]
pub struct LcuClient {
    pub port: u16,
    pub password: String,
    pub pid: u32,
    pub install_path: Option<PathBuf>,
    http: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChampSelectPick {
    pub cell_id: i64,
    pub champion_id: i64,
    pub position: String,
    pub summoner_id: i64,
    pub completed: bool,
    pub is_me: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChampSelectView {
    pub bans: Vec<i64>,
    pub my_team: Vec<ChampSelectPick>,
    pub their_team: Vec<ChampSelectPick>,
    pub my_role: String,
    pub my_champion_id: i64,
    pub phase: String,
}

impl LcuClient {
    pub fn new(port: u16, password: String, pid: u32, install_path: Option<PathBuf>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .danger_accept_invalid_certs(true) // self-signed LCU cert on 127.0.0.1
            .timeout(Duration::from_secs(5))
            .build()?;
        Ok(Self { port, password, pid, install_path, http })
    }

    fn auth_header(&self) -> String {
        let token = STANDARD.encode(format!("riot:{}", self.password));
        format!("Basic {token}")
    }

    fn url(&self, path: &str) -> String {
        format!("https://127.0.0.1:{}{}", self.port, path)
    }

    pub async fn get(&self, path: &str) -> Result<Value> {
        let r = self
            .http
            .get(self.url(path))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        let status = r.status();
        let body = r.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!("GET {path} -> {status}: {body}"));
        }
        Ok(serde_json::from_str(&body).unwrap_or(Value::Null))
    }

    pub async fn post(&self, path: &str, body: Value) -> Result<Value> {
        let r = self
            .http
            .post(self.url(path))
            .header("Authorization", self.auth_header())
            .json(&body)
            .send()
            .await?;
        let status = r.status();
        let text = r.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!("POST {path} -> {status}: {text}"));
        }
        Ok(serde_json::from_str(&text).unwrap_or(Value::Null))
    }

    pub async fn delete(&self, path: &str) -> Result<()> {
        let r = self
            .http
            .delete(self.url(path))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        if !r.status().is_success() {
            let s = r.status();
            let t = r.text().await.unwrap_or_default();
            return Err(anyhow!("DELETE {path} -> {s}: {t}"));
        }
        Ok(())
    }

    pub async fn ready_check_accept(&self) -> Result<()> {
        let _ = self
            .http
            .post(self.url("/lol-matchmaking/v1/ready-check/accept"))
            .header("Authorization", self.auth_header())
            .send()
            .await?;
        Ok(())
    }

    pub async fn ready_check_state(&self) -> Result<Option<String>> {
        let v = self.get("/lol-matchmaking/v1/ready-check").await.unwrap_or(Value::Null);
        Ok(v.get("state").and_then(|x| x.as_str()).map(|s| s.to_string()))
    }

    pub async fn champ_select_session(&self) -> Result<Value> {
        self.get("/lol-champ-select/v1/session").await
    }

    pub async fn gameflow_phase(&self) -> Result<String> {
        let v = self.get("/lol-gameflow/v1/gameflow-phase").await?;
        Ok(v.as_str().unwrap_or("None").to_string())
    }

    /// Exact game version, e.g. "16.21.715.1234". Used to pick the matching
    /// Data Dragon patch instead of blindly using the newest one.
    pub async fn game_version(&self) -> Option<String> {
        let v = self.get("/lol-patch/v1/game-version").await.ok()?;
        v.as_str().map(|s| s.to_string())
    }

    /// Item sets the client has for a champion: LCU item-sets API plus
    /// `<install>/Config/Champions/<champ>/Recommended/*.json`. Blitz and
    /// similar apps write one of these. Our own CGO_ files are skipped.
    pub async fn item_sets(&self, champion: &str, champion_key: i64) -> Vec<Value> {
        let mut out = Vec::new();

        if let Ok(me) = self.get("/lol-summoner/v1/current-summoner").await {
            if let Some(sid) = me.get("summonerId").and_then(|v| v.as_i64()) {
                if let Ok(v) = self.get(&format!("/lol-item-sets/v1/item-sets/{sid}/sets")).await {
                    for set in v.get("itemSets").and_then(|x| x.as_array()).cloned().unwrap_or_default() {
                        let champs: Vec<i64> = set
                            .get("associatedChampions")
                            .and_then(|x| x.as_array())
                            .map(|a| a.iter().filter_map(|c| c.as_i64()).collect())
                            .unwrap_or_default();
                        if !champs.contains(&champion_key) {
                            continue;
                        }
                        let maps: Vec<i64> = set
                            .get("associatedMaps")
                            .and_then(|x| x.as_array())
                            .map(|a| a.iter().filter_map(|c| c.as_i64()).collect())
                            .unwrap_or_default();
                        if !maps.is_empty() && !maps.contains(&11) {
                            continue;
                        }
                        if let Some(norm) = normalize_item_set(&set, champion, "lcu") {
                            out.push(norm);
                        }
                    }
                }
            }
        }

        if let Some(install) = &self.install_path {
            let dir = install.join("Config").join("Champions").join(champion).join("Recommended");
            if let Ok(mut rd) = tokio::fs::read_dir(&dir).await {
                while let Ok(Some(entry)) = rd.next_entry().await {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !name.ends_with(".json") || name.starts_with("CGO_") {
                        continue;
                    }
                    if let Ok(bytes) = tokio::fs::read(entry.path()).await {
                        if let Ok(set) = serde_json::from_slice::<Value>(&bytes) {
                            if let Some(norm) = normalize_item_set(&set, champion, "file") {
                                out.push(norm);
                            }
                        }
                    }
                }
            }
        }

        tracing::info!("item sets for {champion}: {}", out.len());
        out
    }

    /// Import a full rune page. Deletes editable pages until under the quota, then creates ours.
    pub async fn import_rune_page(&self, page: Value) -> Result<()> {
        let inv = self
            .get("/lol-perks/v1/pages")
            .await
            .unwrap_or(Value::Array(vec![]));
        if let Some(arr) = inv.as_array() {
            for p in arr {
                if p.get("isDeletable").and_then(|b| b.as_bool()).unwrap_or(false) {
                    if let Some(id) = p.get("id").and_then(|x| x.as_i64()) {
                        let _ = self.delete(&format!("/lol-perks/v1/pages/{id}")).await;
                    }
                }
            }
        }
        self.post("/lol-perks/v1/pages", page).await?;
        Ok(())
    }

    /// Write a Blitz-style item set file into the install's Config/Champions folder.
    pub async fn import_item_build(&self, build: Value) -> Result<()> {
        let install = self
            .install_path
            .clone()
            .ok_or_else(|| anyhow!("install path unknown; can't write item set"))?;

        let champion = build
            .get("associatedChampions")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("associatedChampions missing"))?
            .to_string();

        let name = build
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Coach Build")
            .to_string();

        let dir = install
            .join("Config")
            .join("Champions")
            .join(&champion)
            .join("Recommended");
        tokio::fs::create_dir_all(&dir).await?;

        let safe_name = name
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == ' ' || c == '-' { c } else { '_' })
            .collect::<String>();
        let path = dir.join(format!("CGO_{}.json", safe_name));
        tokio::fs::write(&path, serde_json::to_vec_pretty(&build)?).await?;
        Ok(())
    }

    /// Parse champ-select session JSON into a trimmed view the UI can consume.
    pub fn parse_champ_select(session: &Value) -> Option<ChampSelectView> {
        if !session.is_object() {
            return None;
        }

        let my_cell_id = session
            .get("localPlayerCellId")
            .and_then(|v| v.as_i64())
            .unwrap_or(-1);

        let parse_team = |arr: Option<&Vec<Value>>| -> Vec<ChampSelectPick> {
            arr.map(|v| {
                v.iter()
                    .map(|p| {
                        let cell_id = p.get("cellId").and_then(|v| v.as_i64()).unwrap_or(-1);
                        ChampSelectPick {
                            cell_id,
                            champion_id: p.get("championId").and_then(|v| v.as_i64()).unwrap_or(0),
                            position: p
                                .get("assignedPosition")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string(),
                            summoner_id: p.get("summonerId").and_then(|v| v.as_i64()).unwrap_or(0),
                            completed: p.get("completed").and_then(|v| v.as_bool()).unwrap_or(false),
                            is_me: cell_id == my_cell_id,
                        }
                    })
                    .collect()
            })
            .unwrap_or_default()
        };

        let my_team =
            parse_team(session.get("myTeam").and_then(|v| v.as_array()));
        let their_team =
            parse_team(session.get("theirTeam").and_then(|v| v.as_array()));

        // Bans come from `actions`: each action with type == "ban" and completed == true.
        let mut bans = Vec::new();
        if let Some(actions) = session.get("actions").and_then(|v| v.as_array()) {
            for group in actions {
                if let Some(g) = group.as_array() {
                    for a in g {
                        let is_ban = a
                            .get("type")
                            .and_then(|v| v.as_str())
                            .map(|t| t.eq_ignore_ascii_case("ban"))
                            .unwrap_or(false);
                        let done = a.get("completed").and_then(|v| v.as_bool()).unwrap_or(false);
                        let cid = a.get("championId").and_then(|v| v.as_i64()).unwrap_or(0);
                        if is_ban && done && cid > 0 {
                            bans.push(cid);
                        }
                    }
                }
            }
        }

        let (my_role, my_champion_id) = my_team
            .iter()
            .find(|p| p.is_me)
            .map(|p| (p.position.clone(), p.champion_id))
            .unwrap_or_default();

        let phase = session
            .get("timer")
            .and_then(|t| t.get("phase"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Some(ChampSelectView {
            bans,
            my_team,
            their_team,
            my_role,
            my_champion_id,
            phase,
        })
    }
}

/// Normalize both the LCU and the file item-set formats to
/// { title, source, champion, blocks: [{ type, items: ["3031", ...] }] }.
fn normalize_item_set(set: &Value, champion: &str, source: &str) -> Option<Value> {
    let title = set
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("item set")
        .to_string();
    if title.starts_with("CGO_") {
        return None;
    }
    let blocks: Vec<Value> = set
        .get("blocks")
        .and_then(|b| b.as_array())?
        .iter()
        .map(|b| {
            let items: Vec<String> = b
                .get("items")
                .and_then(|i| i.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|it| match it.get("id") {
                            Some(Value::String(s)) => Some(s.clone()),
                            Some(Value::Number(n)) => Some(n.to_string()),
                            _ => None,
                        })
                        .collect()
                })
                .unwrap_or_default();
            serde_json::json!({
                "type": b.get("type").and_then(|t| t.as_str()).unwrap_or(""),
                "items": items,
            })
        })
        .collect();
    if blocks.is_empty() {
        return None;
    }
    Some(serde_json::json!({
        "title": title,
        "source": source,
        "champion": champion,
        "blocks": blocks,
    }))
}

async fn find_install_path() -> Option<PathBuf> {
    // System::new_all() already refreshes the process list; sysinfo 0.32's
    // refresh_processes() now requires ProcessesToUpdate + remove_dead params,
    // so we just use the fresh snapshot from new_all().
    let sys = System::new_all();
    for (_, p) in sys.processes() {
        let name = p.name().to_string_lossy().to_lowercase();
        if name == "leagueclient.exe" || name == "leagueclient" {
            if let Some(exe) = p.exe() {
                if let Some(dir) = exe.parent() {
                    return Some(dir.to_path_buf());
                }
            }
        }
    }
    for p in [
        r"C:\Riot Games\League of Legends",
        r"C:\Program Files\Riot Games\League of Legends",
        r"C:\Program Files (x86)\Riot Games\League of Legends",
    ] {
        let pb = PathBuf::from(p);
        if pb.join("lockfile").exists() {
            return Some(pb);
        }
    }
    None
}

async fn read_lockfile() -> Option<(u16, String, u32, PathBuf)> {
    let install = find_install_path().await?;
    let lock = install.join("lockfile");
    let content = tokio::fs::read_to_string(&lock).await.ok()?;
    let parts: Vec<&str> = content.trim().split(':').collect();
    if parts.len() < 5 {
        return None;
    }
    let pid: u32 = parts[1].parse().ok()?;
    let port: u16 = parts[2].parse().ok()?;
    let password = parts[3].to_string();
    Some((port, password, pid, install))
}

pub async fn run_watcher(state: Arc<AppState>, app: AppHandle) {
    let mut last_phase = String::new();
    let mut last_champ_select_sig = String::new();

    loop {
        if state.lcu.read().is_some() {
            let maybe = state.lcu.read().clone();
            if let Some(client) = maybe {
                match client.gameflow_phase().await {
                    Err(_) => {
                        tracing::info!("LCU disconnected");
                        *state.lcu.write() = None;
                    }
                    Ok(phase) => {
                        handle_tick(&state, &client, &app, &phase, &mut last_phase, &mut last_champ_select_sig).await;
                    }
                }
            }
            sleep(Duration::from_millis(1000)).await;
            continue;
        }

        if let Some((port, password, pid, install)) = read_lockfile().await {
            match LcuClient::new(port, password, pid, Some(install)) {
                Ok(c) => {
                    if c.gameflow_phase().await.is_ok() {
                        let ver = c.game_version().await.unwrap_or_default();
                        tracing::info!("LCU connected on port {port}, game version {ver}");
                        *state.lcu.write() = Some(c);
                        let _ = app.emit("lcu:connected", ver);
                    }
                }
                Err(e) => tracing::warn!("LCU client build failed: {e}"),
            }
        }

        sleep(Duration::from_millis(2000)).await;
    }
}

async fn handle_tick(
    state: &Arc<AppState>,
    client: &LcuClient,
    app: &AppHandle,
    phase: &str,
    last_phase: &mut String,
    last_sig: &mut String,
) {
    let auto = state.settings.read().automation.clone();

    // Phase change notification.
    if phase != last_phase.as_str() {
        let _ = app.emit("lcu:phase", phase);
        *last_phase = phase.to_string();
        if phase != "ChampSelect" {
            // Clear sig so re-entry re-emits.
            last_sig.clear();
            let _ = app.emit("champselect:end", true);
        }
    }

    // Ready-check auto-accept.
    if auto.auto_accept {
        if let Ok(Some(s)) = client.ready_check_state().await {
            if s == "InProgress" {
                if let Err(e) = client.ready_check_accept().await {
                    tracing::warn!("accept failed: {e}");
                }
            }
        }
    }

    // Champ-select stream.
    if phase == "ChampSelect" {
        match client.champ_select_session().await {
            Ok(session) => {
                if let Some(view) = LcuClient::parse_champ_select(&session) {
                    let sig = format!(
                        "{}|{:?}|{:?}|{}",
                        view.my_champion_id,
                        view.bans,
                        view.my_team
                            .iter()
                            .chain(view.their_team.iter())
                            .map(|p| p.champion_id)
                            .collect::<Vec<_>>(),
                        view.phase
                    );
                    if sig != *last_sig {
                        *last_sig = sig;
                        let _ = app.emit("champselect:update", view);
                    }
                }
            }
            Err(e) => tracing::debug!("champ_select_session: {e}"),
        }
    }
}
