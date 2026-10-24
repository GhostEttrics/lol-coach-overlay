// Riot Data Dragon mirror.
//
// Static CDN at https://ddragon.leagueoflegends.com. For each patch:
//     /api/versions.json                  -> list of patches, latest first
//     /cdn/<v>/data/<locale>/champion.json
//     /cdn/<v>/data/<locale>/item.json
//     /cdn/<v>/data/<locale>/runesReforged.json
//     /cdn/<v>/data/<locale>/summoner.json
//
// Locale is driven by UserSettings.lang:
//     "pt-BR" → "pt_BR"  (Portuguese Brazil, fully translated)
//     anything else → "en_US"
//
// If a localized blob fails (e.g. a brand new patch where pt_BR is late to the
// CDN), we fall back to en_US for that specific file. Cached per patch+locale
// at `cache_dir/<patch>/<locale>/*.json`.

use anyhow::{anyhow, Result};
use serde_json::Value;
use std::{path::PathBuf, time::Duration};
use tokio::fs;

pub struct DataDragon {
    http: reqwest::Client,
    cache: PathBuf,
}

impl DataDragon {
    pub fn new(cache: PathBuf) -> Self {
        Self {
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(10))
                .build()
                .expect("http"),
            cache,
        }
    }

    pub async fn versions(&self) -> Result<Vec<String>> {
        let r: Vec<String> = self
            .http
            .get("https://ddragon.leagueoflegends.com/api/versions.json")
            .send()
            .await?
            .json()
            .await?;
        if r.is_empty() {
            return Err(anyhow!("empty versions"));
        }
        Ok(r)
    }

    /// Data Dragon patch matching the running game ("16.21.715.1234" ->
    /// "16.21.1"). Falls back to the newest patch, then to the newest patch
    /// already in the local cache when offline.
    async fn pick_version(&self, game_version: Option<&str>) -> String {
        let wanted: Option<String> = game_version.and_then(|g| {
            let mut it = g.split('.');
            Some(format!("{}.{}.", it.next()?, it.next()?))
        });
        match self.versions().await {
            Ok(list) => {
                if let Some(prefix) = &wanted {
                    if let Some(v) = list.iter().find(|v| v.starts_with(prefix.as_str())) {
                        return v.clone();
                    }
                    tracing::warn!("data_dragon: no patch for game {game_version:?}; using newest {}", list[0]);
                }
                list[0].clone()
            }
            Err(e) => {
                tracing::warn!("data_dragon: versions.json failed: {e}; using cache");
                let mut cached: Vec<String> = std::fs::read_dir(&self.cache)
                    .map(|rd| {
                        rd.filter_map(|e| e.ok())
                            .map(|e| e.file_name().to_string_lossy().to_string())
                            .collect()
                    })
                    .unwrap_or_default();
                cached.sort_by(|a, b| {
                    let pa: Vec<u32> = a.split('.').filter_map(|x| x.parse().ok()).collect();
                    let pb: Vec<u32> = b.split('.').filter_map(|x| x.parse().ok()).collect();
                    pb.cmp(&pa)
                });
                cached.into_iter().next().unwrap_or_else(|| "16.21.1".into())
            }
        }
    }

    pub async fn load_or_fetch(&self, lang: &str, game_version: Option<&str>) -> Result<Value> {
        let v = self.pick_version(game_version).await;
        tracing::info!("data_dragon: patch {v} (game {game_version:?}), lang {lang}");
        let primary = Self::locale_for(lang);
        let fallback = "en_US";

        let primary_dir = self.cache.join(&v).join(primary);
        let fallback_dir = self.cache.join(&v).join(fallback);
        fs::create_dir_all(&primary_dir).await.ok();
        if primary != fallback {
            fs::create_dir_all(&fallback_dir).await.ok();
        }

        let champs = self
            .load_or_download_with_fallback(&primary_dir, &fallback_dir, &v, primary, fallback, "champion")
            .await?;
        let items = self
            .load_or_download_with_fallback(&primary_dir, &fallback_dir, &v, primary, fallback, "item")
            .await?;
        let runes = self
            .load_or_download_with_fallback(&primary_dir, &fallback_dir, &v, primary, fallback, "runesReforged")
            .await?;
        let summoners = self
            .load_or_download_with_fallback(&primary_dir, &fallback_dir, &v, primary, fallback, "summoner")
            .await?;

        Ok(serde_json::json!({
            "version": v,
            "locale": primary,
            "champion": champs,
            "item": items,
            "runes": runes,
            "summoner": summoners,
            "cdn": format!("https://ddragon.leagueoflegends.com/cdn/{v}"),
        }))
    }

    fn locale_for(lang: &str) -> &'static str {
        match lang {
            "pt-BR" | "pt_BR" | "pt" => "pt_BR",
            _ => "en_US",
        }
    }

    async fn load_or_download_with_fallback(
        &self,
        primary_dir: &PathBuf,
        fallback_dir: &PathBuf,
        version: &str,
        primary: &str,
        fallback: &str,
        name: &str,
    ) -> Result<Value> {
        if let Some(v) = Self::read_cached(&primary_dir.join(format!("{name}.json"))).await {
            return Ok(v);
        }
        match self.download(version, primary, name, primary_dir).await {
            Ok(v) => Ok(v),
            Err(e) => {
                if primary == fallback {
                    return Err(e);
                }
                tracing::warn!(
                    "data_dragon: {name} failed in {primary}: {e} — falling back to {fallback}"
                );
                if let Some(v) = Self::read_cached(&fallback_dir.join(format!("{name}.json"))).await
                {
                    return Ok(v);
                }
                self.download(version, fallback, name, fallback_dir).await
            }
        }
    }

    async fn read_cached(path: &PathBuf) -> Option<Value> {
        let bytes = fs::read(path).await.ok()?;
        serde_json::from_slice::<Value>(&bytes).ok()
    }

    async fn download(
        &self,
        version: &str,
        locale: &str,
        name: &str,
        dir: &PathBuf,
    ) -> Result<Value> {
        let url = format!(
            "https://ddragon.leagueoflegends.com/cdn/{version}/data/{locale}/{name}.json"
        );
        let r = self.http.get(&url).send().await?;
        if !r.status().is_success() {
            return Err(anyhow!("{url} -> {}", r.status()));
        }
        let v: Value = r.json().await?;
        let p = dir.join(format!("{name}.json"));
        fs::write(&p, serde_json::to_vec(&v)?).await.ok();
        Ok(v)
    }
}
