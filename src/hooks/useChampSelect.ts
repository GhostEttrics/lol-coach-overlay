// useChampSelect — mirrors the LCU champ-select session into the frontend.
//
// Flow:
//   - Rust watcher polls /lol-champ-select/v1/session once per second whenever
//     gameflow phase is "ChampSelect".
//   - On change (signature diff) it emits "champselect:update" with a parsed view.
//   - On exit it emits "champselect:end".
//   - On mount we also do a pull via `get_champ_select` so a UI opened mid-draft
//     doesn't have to wait for the next change.

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface ChampSelectPick {
  cell_id: number;
  champion_id: number;
  position: string; // "top" | "jungle" | "middle" | "bottom" | "utility" | ""
  summoner_id: number;
  completed: boolean;
  is_me: boolean;
}

export interface ChampSelectView {
  bans: number[];
  my_team: ChampSelectPick[];
  their_team: ChampSelectPick[];
  my_role: string;
  my_champion_id: number;
  phase: string;
}

export function useChampSelect() {
  const [cs, setCs] = useState<ChampSelectView | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Initial pull.
    (async () => {
      try {
        const v = await invoke<ChampSelectView | null>("get_champ_select");
        if (!cancelled) setCs(v);
      } catch {
        /* no LCU — fine */
      }
    })();

    const upd = listen<ChampSelectView>("champselect:update", (e) => setCs(e.payload));
    const end = listen<boolean>("champselect:end", () => setCs(null));

    return () => {
      cancelled = true;
      upd.then((f) => f());
      end.then((f) => f());
    };
  }, []);

  return cs;
}
