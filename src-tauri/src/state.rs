use crate::{data_dragon::DataDragon, lcu::LcuClient, UserSettings};
use anyhow::Result;
use parking_lot::RwLock;
use std::{fs, path::PathBuf, sync::atomic::AtomicBool};
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub app: AppHandle,
    pub interactive: AtomicBool,
    pub settings: RwLock<UserSettings>,
    pub lcu: RwLock<Option<LcuClient>>,
    pub live_snapshot: RwLock<Option<serde_json::Value>>,
    pub data_dragon: DataDragon,
    pub settings_path: PathBuf,
    pub cache_dir: PathBuf,
}

impl AppState {
    pub fn load(app: AppHandle) -> Result<Self> {
        let data_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| dirs::data_local_dir().unwrap().join("lol-coach-overlay"));
        fs::create_dir_all(&data_dir)?;
        let cache_dir = data_dir.join("cache");
        fs::create_dir_all(&cache_dir)?;

        let settings_path = data_dir.join("settings.json");
        let settings: UserSettings = if settings_path.exists() {
            match serde_json::from_slice(&fs::read(&settings_path)?) {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!("settings.json unreadable ({e}); using defaults");
                    UserSettings::default()
                }
            }
        } else {
            UserSettings::default()
        };

        Ok(Self {
            app,
            interactive: AtomicBool::new(false),
            settings: RwLock::new(settings),
            lcu: RwLock::new(None),
            live_snapshot: RwLock::new(None),
            data_dragon: DataDragon::new(cache_dir.clone()),
            settings_path,
            cache_dir,
        })
    }

    pub fn persist_settings(&self) -> Result<()> {
        let s = self.settings.read().clone();
        fs::write(&self.settings_path, serde_json::to_vec_pretty(&s)?)?;
        Ok(())
    }
}
