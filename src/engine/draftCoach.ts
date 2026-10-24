// draftCoach — scores pool vs enemy comp.
// All text output via i18n; engine returns pre-translated reasons.

import type { Champion, DraftSuggestion, Lang, PatchData, Role } from "@/types";
import { t } from "@/i18n";

export interface MatchupTable {
  byRole: Record<Role, Record<string, Record<string, number>>>;
  baseWin: Record<Role, Record<string, number>>;
}

export interface DraftInput {
  bans: string[];
  myPicks: string[];
  enemyPicks: string[];
  myPool: string[];
  myRole: Role;
  patch: PatchData;
  matchupTable?: MatchupTable;
  lang: Lang;
}

export function draftCoach(input: DraftInput): DraftSuggestion[] {
  const { bans, myPicks, enemyPicks, myPool, myRole, patch, matchupTable, lang } = input;

  const taken = new Set([...bans, ...myPicks, ...enemyPicks]);
  const scored: DraftSuggestion[] = [];

  const need = compositionNeed(myPicks, patch);

  for (const champId of myPool) {
    if (taken.has(champId)) continue;
    const champ = patch.champion.data[champId];
    if (!champ) continue;

    const reasons: string[] = [];
    let score = 0;

    const baseWin = matchupTable?.baseWin?.[myRole]?.[champId];
    if (baseWin !== undefined) {
      score += (baseWin - 0.5) * 4;
      if (baseWin > 0.52) {
        reasons.push(
          t(lang, "draft.strongBase", { pct: (baseWin * 100).toFixed(0) })
        );
      }
    }

    let matchupSum = 0;
    let matchupHits = 0;
    for (const vs of enemyPicks) {
      const wr = matchupTable?.byRole?.[myRole]?.[champId]?.[vs];
      if (wr !== undefined) {
        matchupSum += wr - 0.5;
        matchupHits += 1;
      }
    }
    if (matchupHits > 0) {
      const avg = matchupSum / matchupHits;
      score += avg * 6;
      if (avg > 0.03) reasons.push(t(lang, "draft.goodMatchup"));
      if (avg < -0.03) reasons.push(t(lang, "draft.riskyMatchup"));
    }

    const fit = fitReason(champ, need);
    if (fit) {
      score += fit.score;
      reasons.push(t(lang, fit.key as any));
    }

    scored.push({
      championId: champId,
      championName: champ.name,
      score,
      reason: reasons.join(" · ") || t(lang, "draft.safeDefault"),
      iconUrl: `${patch.cdn}/img/champion/${champ.image.full}`,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

interface CompNeed {
  needsAP: boolean;
  needsAD: boolean;
  needsFrontline: boolean;
  needsEngage: boolean;
}

function compositionNeed(myPicks: string[], patch: PatchData): CompNeed {
  let ap = 0,
    ad = 0,
    tanks = 0,
    engagers = 0;
  for (const id of myPicks) {
    const c = patch.champion.data[id];
    if (!c) continue;
    if (c.info.magic >= 7) ap += 1;
    if (c.info.attack >= 7) ad += 1;
    if (c.tags?.includes("Tank")) tanks += 1;
    if (c.tags?.includes("Fighter") || c.tags?.includes("Tank")) engagers += 1;
  }
  return {
    needsAP: ap === 0,
    needsAD: ad === 0,
    needsFrontline: tanks === 0,
    needsEngage: engagers === 0,
  };
}

function fitReason(
  c: Champion,
  need: CompNeed
): { key: string; score: number } | null {
  if (need.needsFrontline && c.tags?.includes("Tank")) {
    return { key: "draft.needsFrontline", score: 1.2 };
  }
  if (need.needsAP && c.info.magic >= 7) {
    return { key: "draft.needsAP", score: 1.0 };
  }
  if (need.needsAD && c.info.attack >= 7) {
    return { key: "draft.needsAD", score: 1.0 };
  }
  if (
    need.needsEngage &&
    (c.tags?.includes("Fighter") || c.tags?.includes("Tank"))
  ) {
    return { key: "draft.needsEngage", score: 0.5 };
  }
  return null;
}
