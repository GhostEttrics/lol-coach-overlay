// Cross-phase context that must survive pane switches:
//   - draft role: resolved during champ select, reused in-game when the
//     Live Client sends an empty position (bot games, blind, customs);
//   - client item set: the build order the League client already has for
//     the champion (Blitz writes these), fetched once per champion.

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import { useChampSelect } from "./useChampSelect";
import { champIdOf, findMe, inferRoleFromChampion, normRole } from "@/engine/role";
import type { ClientItemSet, PatchData, Role } from "@/types";

function idFromKey(patch: PatchData | null, key: number): string | null {
  if (!patch || !key) return null;
  const s = String(key);
  for (const [id, c] of Object.entries(patch.champion.data)) if (c.key === s) return id;
  return null;
}

export type DraftRoleSource = "assigned" | "champion" | "last" | "override" | "none";

export function useDraftRole(): { role: Role | null; source: DraftRoleSource } {
  const cs = useChampSelect();
  const patch = useStore((s) => s.patch);
  const lastRole = useStore((s) => s.settings.last_role ?? null);
  const setDraftRole = useStore((s) => s.setDraftRole);
  const setRoleOverride = useStore((s) => s.setRoleOverride);
  const override = useStore((s) => s.roleOverride);

  // New draft: forget the previous game's override.
  useEffect(() => {
    const un = listen<string>("lcu:phase", (e) => {
      if (e.payload === "ChampSelect") setRoleOverride(null);
    });
    return () => {
      un.then((f) => f());
    };
  }, [setRoleOverride]);

  let role: Role | null = null;
  let source: DraftRoleSource = "none";
  if (cs) {
    const me = cs.my_team.find((p) => p.is_me);
    const assigned = normRole(me?.position);
    const champ = me && me.champion_id > 0 ? patch?.champion.data[idFromKey(patch, me.champion_id) ?? ""] : null;
    if (assigned) {
      role = assigned;
      source = "assigned";
    } else if (champ) {
      role = inferRoleFromChampion(champ);
      source = "champion";
    } else if (lastRole) {
      role = lastRole;
      source = "last";
    }
  }
  const effective = override ?? role;

  useEffect(() => {
    if (cs) setDraftRole(effective);
  }, [cs, effective, setDraftRole]);

  return { role: effective, source: override ? "override" : source };
}

export function useClientItemSet() {
  const live = useStore((s) => s.live);
  const patch = useStore((s) => s.patch);
  const setClientSet = useStore((s) => s.setClientSet);
  const cs = useChampSelect();
  const lastChamp = useRef<string | null>(null);

  // Champion: in-game from Live Client, in draft from the locked pick.
  let champId: string | null = null;
  if (live) {
    const me = findMe(live);
    if (me) champId = champIdOf(me);
  } else if (cs) {
    const me = cs.my_team.find((p) => p.is_me);
    if (me && me.champion_id > 0) champId = idFromKey(patch, me.champion_id);
  }
  const champKey = champId && patch ? Number(patch.champion.data[champId]?.key ?? 0) : 0;

  // Retry when the client (re)connects or a new game starts: an earlier
  // fetch may have run before the LCU was reachable.
  useEffect(() => {
    const reset = () => {
      lastChamp.current = null;
    };
    const a = listen("lcu:connected", reset);
    const b = listen("ingame:start", reset);
    return () => {
      a.then((f) => f());
      b.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (!champId || !champKey || lastChamp.current === champId) return;
    lastChamp.current = champId;
    (async () => {
      try {
        const sets = await invoke<ClientItemSet[]>("get_item_sets", {
          champion: champId,
          championKey: champKey,
        });
        const usable = (sets ?? []).filter((s) => !s.title.startsWith("CGO_"));
        const best =
          usable.find((s) => /blitz/i.test(s.title)) ??
          usable.sort(
            (a, b) =>
              b.blocks.reduce((n, x) => n + x.items.length, 0) - a.blocks.reduce((n, x) => n + x.items.length, 0)
          )[0] ??
          null;
        setClientSet(best);
        console.info(`[build] ${champId}: ${usable.length} client item sets; using ${best ? best.title : "template"}`);
      } catch (e) {
        console.warn("get_item_sets failed", e);
        setClientSet(null);
      }
    })();
  }, [champId, champKey, setClientSet]);
}
