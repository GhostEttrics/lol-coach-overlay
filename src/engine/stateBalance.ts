// balanceState: tempo (gold proxy) + the player's ROLE -> win condition.
//
// Text is chosen by role x tempo and role x phase. The old version had one
// generic sentence per tempo that happened to mention mid, which is why a
// Caitlyn bot was told to "win the first mid rotation".

import type { Lang, LiveSnapshot, Phase, PlayerShort, Role, StateBalance, Tempo } from "@/types";
import { tx } from "@/i18n";
import { teams } from "./role";

export function phaseOf(gameTime: number): Phase {
  if (gameTime < 14 * 60) return "early";
  if (gameTime < 25 * 60) return "mid";
  return "late";
}

export function teamGoldProxy(team: PlayerShort[]): number {
  let s = 0;
  for (const p of team) {
    const k = p.scores?.kills ?? 0;
    const a = p.scores?.assists ?? 0;
    const cs = p.scores?.creepScore ?? 0;
    let items = 0;
    for (const it of p.items ?? []) items += (it.price ?? 0) * Math.max(1, it.count ?? 1);
    s += k * 300 + a * 150 + cs * 20 + items;
  }
  return s;
}

export function tempoOf(live: LiveSnapshot): { tempo: Tempo; diff: number } {
  const { allies, enemies } = teams(live);
  const diff = teamGoldProxy(allies) - teamGoldProxy(enemies);
  const tempo: Tempo = diff > 1500 ? "ahead" : diff < -1500 ? "behind" : "even";
  return { tempo, diff };
}

export function balanceState(live: LiveSnapshot, role: Role, lang: Lang): StateBalance {
  const { tempo } = tempoOf(live);
  const phase = phaseOf(live.gameData.gameTime ?? 0);
  return {
    tempo,
    winCondition: tx(lang, `win.${role}.${tempo}`),
    priority: tx(lang, `prio.${role}.${phase}`),
    recoveryPlan: tempo === "behind" ? tx(lang, `recovery.${phase}`) : undefined,
  };
}
