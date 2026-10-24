import { create } from "zustand";
import type { ClientItemSet, LiveSnapshot, PatchData, Role, UserSettings } from "@/types";

interface S {
  settings: UserSettings;
  patch: PatchData | null;
  live: LiveSnapshot | null;
  inGame: boolean;
  minimized: boolean;
  silent: boolean;
  interactive: boolean;
  deathsStreak: number;
  draftRole: Role | null;
  roleOverride: Role | null;
  clientSet: ClientItemSet | null;
  setSettings: (s: UserSettings) => void;
  setPatch: (p: PatchData) => void;
  setLive: (s: LiveSnapshot | null) => void;
  setInGame: (v: boolean) => void;
  setInteractive: (v: boolean) => void;
  setDraftRole: (r: Role | null) => void;
  setRoleOverride: (r: Role | null) => void;
  setClientSet: (s: ClientItemSet | null) => void;
  bumpDeath: () => void;
  resetDeath: () => void;
}

export const defaultSettings: UserSettings = {
  theme: "dark",
  lang: "pt-BR",
  detail_level: "medium",
  pool: { TOP: [], JUNGLE: [], MIDDLE: [], BOTTOM: [], UTILITY: [] },
  automation: {
    auto_accept: false,
    auto_import_runes: false,
    auto_buy: false,
    elo_filter: null,
    queue_timeout_s: null,
  },
  overlay: { click_through: true, position: null, minimized: false, silent: false, scale: 1, corner: "top-left" },
  last_role: null,
  panel_cards: {},
  notify: { sound_affordable: false, voice: false },
};

function merge(s: Partial<UserSettings> | null | undefined): UserSettings {
  const m = { ...defaultSettings, ...(s ?? {}) };
  m.overlay = { ...defaultSettings.overlay, ...(s?.overlay ?? {}) };
  m.automation = { ...defaultSettings.automation, ...(s?.automation ?? {}) };
  m.notify = { ...defaultSettings.notify, ...(s?.notify ?? {}) };
  m.pool = s?.pool ?? {};
  m.panel_cards = s?.panel_cards ?? {};
  return m;
}

export const useStore = create<S>((set) => ({
  settings: defaultSettings,
  patch: null,
  live: null,
  inGame: false,
  minimized: false,
  silent: false,
  interactive: false,
  deathsStreak: 0,
  draftRole: null,
  roleOverride: null,
  clientSet: null,
  setSettings: (s) => {
    const m = merge(s);
    set({ settings: m, minimized: m.overlay.minimized, silent: m.overlay.silent });
  },
  setPatch: (p) => set({ patch: p }),
  setLive: (s) => set({ live: s }),
  setInGame: (v) => set({ inGame: v }),
  setInteractive: (v) => set({ interactive: v }),
  setDraftRole: (r) => set({ draftRole: r }),
  setRoleOverride: (r) => set({ roleOverride: r }),
  setClientSet: (s) => set({ clientSet: s }),
  bumpDeath: () => set((st) => ({ deathsStreak: st.deathsStreak + 1 })),
  resetDeath: () => set({ deathsStreak: 0 }),
}));

export function cardEnabled(settings: UserSettings, id: string): boolean {
  const v = (settings.panel_cards as Record<string, boolean>)?.[id];
  return v !== false;
}
