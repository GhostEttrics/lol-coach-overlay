import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { resolveMyRole } from "@/engine/role";
import { ROLES, type Role, type RoleSource } from "@/types";

export function useMyRole(): { role: Role; source: RoleSource } | null {
  const live = useStore((s) => s.live);
  const patch = useStore((s) => s.patch);
  const draftRole = useStore((s) => s.draftRole);
  const override = useStore((s) => s.roleOverride);
  return useMemo(
    () => (live ? resolveMyRole(live, patch, draftRole, override) : null),
    [live, patch, draftRole, override]
  );
}

// Cycle to the next role, remember it as an override for this game and as
// last_role for the next game without assigned positions.
export async function cycleRole(current: Role) {
  const st = useStore.getState();
  const next = ROLES[(ROLES.indexOf(current) + 1) % ROLES.length];
  st.setRoleOverride(next);
  const settings = { ...st.settings, last_role: next };
  st.setSettings(settings);
  try {
    await invoke("save_settings", { settings });
  } catch (e) {
    console.error("save_settings failed", e);
  }
}

export async function chooseRole(role: Role) {
  const st = useStore.getState();
  st.setRoleOverride(role);
  const settings = { ...st.settings, last_role: role };
  st.setSettings(settings);
  try {
    await invoke("save_settings", { settings });
  } catch (e) {
    console.error("save_settings failed", e);
  }
}
