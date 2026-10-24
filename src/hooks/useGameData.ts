// One place that turns the live snapshot into everything the UI shows, so the
// overlay and the panel never compute the same thing twice or drift apart.

import { useMemo, useRef } from "react";
import { useStore } from "@/store";
import { useMyRole } from "./useMyRole";
import { recommendNextItem } from "@/engine/itemRecommender";
import { balanceState, tempoOf } from "@/engine/stateBalance";
import { objectiveCall, objectiveState } from "@/engine/objectives";
import { coachTips, newTipMemory, type TipMemory } from "@/engine/coachTips";
import { computeThreat } from "@/engine/threatAnalysis";
import { champOf, findMe, laneOpponent, teams } from "@/engine/role";
import type {
  CoachTip,
  GameEvent,
  ItemRecommendation,
  ObjectiveCall,
  PlayerShort,
  Role,
  RoleSource,
  StateBalance,
} from "@/types";
import type { ThreatProfile } from "@/engine/threatAnalysis";

export interface LaneMatchup {
  me: PlayerShort;
  opp: PlayerShort | null;
  meName: string;
  oppName: string;
  meIcon: string;
  oppIcon: string;
  csDiff: number;
  lvlDiff: number;
}

export interface GameData {
  role: { role: Role; source: RoleSource } | null;
  me: PlayerShort | null;
  champName: string;
  champIcon: string | null;
  rec: ItemRecommendation | null;
  itemIcon?: string;
  goldDiff: number;
  balance: StateBalance | null;
  tempoDiff: number;
  objective: ObjectiveCall | null;
  dragonScore: { mine: number; enemy: number };
  tips: CoachTip[];
  threat: ThreatProfile | null;
  threats: { name: string; icon: string; weight: number }[];
  lane: LaneMatchup | null;
}

const EMPTY: GameData = {
  role: null,
  me: null,
  champName: "",
  champIcon: null,
  rec: null,
  itemIcon: undefined,
  goldDiff: 0,
  balance: null,
  tempoDiff: 0,
  objective: null,
  dragonScore: { mine: 0, enemy: 0 },
  tips: [],
  threat: null,
  threats: [],
  lane: null,
};

export function useGameData(lastEvent: GameEvent | null = null): GameData {
  const live = useStore((s) => s.live);
  const patch = useStore((s) => s.patch);
  const lang = useStore((s) => s.settings.lang);
  const clientSet = useStore((s) => s.clientSet);
  const deathsStreak = useStore((s) => s.deathsStreak);
  const role = useMyRole();
  const memory = useRef<TipMemory>(newTipMemory());

  return useMemo(() => {
    if (!live || !patch || !role) return EMPTY;
    const me = findMe(live);
    if (!me) return EMPTY;
    const champ = champOf(me, patch);
    const { enemies } = teams(live);
    const threat = computeThreat(live, patch);
    const st = objectiveState(live, patch);
    const opp = laneOpponent(live, patch, role.role);
    const rec = recommendNextItem({ live, patch, role: role.role, lang, clientSet });

    const icon = (p: PlayerShort) => {
      const c = champOf(p, patch);
      return c ? `${patch.cdn}/img/champion/${c.image.full}` : "";
    };

    return {
      role,
      me,
      champName: champ?.name ?? me.championName,
      champIcon: champ ? `${patch.cdn}/img/champion/${champ.image.full}` : null,
      rec,
      itemIcon: rec?.iconUrl,
      goldDiff: tempoOf(live).diff,
      balance: balanceState(live, role.role, lang),
      tempoDiff: tempoOf(live).diff,
      objective: objectiveCall(st, role.role, lang),
      dragonScore: { mine: st.myDragons, enemy: st.enemyDragons },
      tips: coachTips({ live, patch, role: role.role, lang, deathsStreak, lastEvent, memory: memory.current }),
      threat,
      threats: enemies.map((e) => {
        const c = champOf(e, patch);
        const name = c?.name ?? e.championName;
        // Per-enemy threat: how many situational buckets name them.
        const w = Object.values(threat.by).reduce((n, arr) => n + (arr.includes(name) ? 1 : 0), 0);
        return { name, icon: icon(e), weight: Math.min(1, 0.25 + w * 0.25) };
      }),
      lane: {
        me,
        opp,
        meName: champ?.name ?? me.championName,
        oppName: opp ? champOf(opp, patch)?.name ?? opp.championName : "",
        meIcon: icon(me),
        oppIcon: opp ? icon(opp) : "",
        csDiff: (me.scores?.creepScore ?? 0) - (opp?.scores?.creepScore ?? 0),
        lvlDiff: me.level - (opp?.level ?? 0),
      },
    };
  }, [live, patch, role, lang, clientSet, deathsStreak, lastEvent]);
}
