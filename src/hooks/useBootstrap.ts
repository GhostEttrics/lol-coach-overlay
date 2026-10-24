// Shared bootstrap for every window: pull settings + patch, subscribe to live
// data and to cross-window sync events. The overlay also owns the Live Client
// death-streak bookkeeping; panel and settings just read the store.

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import { usePatch } from "./usePatch";
import { useLiveClient } from "./useLiveClient";
import { useDraftRole, useClientItemSet } from "./useGameContext";
import { useEngineLog } from "./useEngineLog";
import { findMe, findPlayerByName, samePlayer } from "@/engine/role";
import type { GameEvent, UserSettings } from "@/types";

export function useBootstrap(opts: { engine?: boolean } = {}): { lastEvent: GameEvent | null } {
  const setSettings = useStore((s) => s.setSettings);
  const setInteractive = useStore((s) => s.setInteractive);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);

  // Settings: initial pull + stay in sync with other windows.
  useEffect(() => {
    invoke<UserSettings>("get_settings").then(setSettings).catch(() => {});
    invoke<boolean>("get_interactive").then(setInteractive).catch(() => {});
    const unS = listen<UserSettings>("settings:changed", (e) => setSettings(e.payload));
    const unI = listen<boolean>("overlay:interactive", (e) => setInteractive(e.payload));
    return () => {
      unS.then((f) => f());
      unI.then((f) => f());
    };
  }, [setSettings, setInteractive]);

  usePatch();
  useDraftRole();
  useClientItemSet();
  if (opts.engine) useEngineLog();

  useLiveClient((ev) => {
    setLastEvent(ev);
    if (ev.EventName !== "ChampionKill") return;
    const live = useStore.getState().live;
    if (!live) return;
    const me = findMe(live);
    if (!me) return;
    const victim = findPlayerByName(live, ev.VictimName);
    const killer = findPlayerByName(live, ev.KillerName);
    if (victim && samePlayer(victim, me)) useStore.getState().bumpDeath();
    if (killer && samePlayer(killer, me)) useStore.getState().resetDeath();
  });

  useEffect(() => {
    const un = listen<boolean>("ingame:start", () => useStore.getState().resetDeath());
    return () => {
      un.then((f) => f());
    };
  }, []);

  return { lastEvent };
}

// Persist a settings change from any window.
export async function saveSettings(next: UserSettings) {
  useStore.getState().setSettings(next);
  try {
    await invoke("save_settings", { settings: next });
  } catch (e) {
    console.error("save_settings failed", e);
  }
}
