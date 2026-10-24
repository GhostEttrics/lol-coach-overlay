// Writes what the engine decided to the app log, so a 10 minute game can be
// reviewed afterwards. Only logs on change, plus a heartbeat every 30s.
// File: %APPDATA%\dev.nyx.lolcoachoverlay\logs\app.log

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { useMyRole } from "./useMyRole";
import { recommendNextItem } from "@/engine/itemRecommender";
import { balanceState } from "@/engine/stateBalance";
import { objectiveCall, objectiveState, fmtTime } from "@/engine/objectives";
import { findMe } from "@/engine/role";

export function useEngineLog() {
  const live = useStore((s) => s.live);
  const patch = useStore((s) => s.patch);
  const clientSet = useStore((s) => s.clientSet);
  const role = useMyRole();
  const last = useRef<{ sig: string; at: number }>({ sig: "", at: -999 });

  useEffect(() => {
    if (!live || !patch || !role) return;
    try {
      const me = findMe(live);
      const rec = recommendNextItem({ live, patch, role: role.role, lang: "en", clientSet });
      const bal = balanceState(live, role.role, "en");
      const call = objectiveCall(objectiveState(live, patch), role.role, "en");
      const now = live.gameData.gameTime ?? 0;
      const sig = [
        role.role,
        role.source,
        rec?.itemId,
        rec?.stage,
        rec?.effectiveCost,
        bal.tempo,
        call?.kind,
        call?.severity,
        (me?.items ?? []).map((i) => i.itemID).join("."),
      ].join("|");
      if (sig === last.current.sig && now - last.current.at < 30) return;
      last.current = { sig, at: now };
      const line =
        `t=${fmtTime(now)} champ=${me?.championName} pos="${me?.position ?? ""}" role=${role.role}(${role.source}) ` +
        `gold=${Math.round(live.activePlayer.currentGold)} inv=[${(me?.items ?? []).map((i) => i.itemID).join(",")}] ` +
        `rec=${rec ? `${rec.itemId}:${rec.name} stage=${rec.stage}#${rec.step} src=${rec.source} eff=${rec.effectiveCost}/${rec.gold} buyNow=[${rec.buyNow.map((b) => b.itemId).join(",")}]` : "none"} ` +
        `tempo=${bal.tempo} call=${call ? `${call.kind}:${call.severity}` : "none"}`;
      invoke("log_engine", { line }).catch(() => {});
    } catch (e) {
      invoke("log_engine", { line: `engine error: ${String(e)}` }).catch(() => {});
    }
  }, [live, patch, role, clientSet]);
}
