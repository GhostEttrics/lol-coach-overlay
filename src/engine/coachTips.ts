// Situational tips computed from what the Live Client actually exposes.
//
// Live Client gives: every player's champion, level, items, KDA, CS,
// dead/respawn timer, summoner spells, plus kill/objective events. It does
// NOT give positions, cooldowns or jungle camps, so no tip pretends to know
// those. Every tip is "action: reason", 2 lines max.
//
// Generic rotating phase hints were removed: they were the "dicas genéricas"
// that added nothing.

import type { CoachTip, GameEvent, Lang, LiveSnapshot, PatchData, PlayerShort, Role } from "@/types";
import { tx } from "@/i18n";
import { champOf, findPlayerByName, laneOpponent, samePlayer, teams } from "./role";
import { isLegendary } from "./items";
import { objectiveState } from "./objectives";
import { phaseOf } from "./stateBalance";
import { computeThreat } from "./threatAnalysis";
import { archetypeOf } from "./buildTemplates";

export interface TipMemory {
  initialized: boolean;
  firstSeen: Map<string, number>; // key -> gameTime first seen
  legendaries: Map<string, Set<string>>; // player key -> legendary ids
}

export function newTipMemory(): TipMemory {
  return { initialized: false, firstSeen: new Map(), legendaries: new Map() };
}

export interface TipCtx {
  live: LiveSnapshot;
  patch: PatchData;
  role: Role;
  lang: Lang;
  deathsStreak: number;
  lastEvent: GameEvent | null;
  memory: TipMemory;
}

const DEFENSIVE: Record<string, string> = {
  "3026": "ga",
  "3157": "zhonya",
  "3140": "qss",
  "3139": "qss",
  "3814": "eon",
  "3102": "banshee",
  "6673": "shieldbow",
};
const ANTI_HEAL = new Set(["3123", "3033", "6609", "3916", "3165", "3075", "3076"]);

const SEV = { crit: 3, warn: 2, info: 1 } as const;

function pkey(p: PlayerShort): string {
  return (p.riotId || p.summonerName || p.championName).toLowerCase();
}

export function coachTips(ctx: TipCtx): CoachTip[] {
  const { live, patch, role, lang, memory } = ctx;
  const now = live.gameData.gameTime ?? 0;
  const phase = phaseOf(now);
  const { me, allies, enemies } = teams(live);
  if (!me) return [];

  const tips: CoachTip[] = [];
  const add = (id: string, severity: CoachTip["severity"], key: string, vars: Record<string, string | number>, prio = 0) =>
    tips.push({ id, severity, message: tx(lang, key, vars), phase, prio });
  const nameOf = (p: PlayerShort) => champOf(p, patch)?.name ?? p.championName;
  const itemName = (id: string) => patch.item.data[id]?.name ?? id;

  // --- memory: first-seen times for items, legendary diffs -----------------
  const seenNow = (key: string) => {
    if (!memory.firstSeen.has(key)) memory.firstSeen.set(key, now);
    return memory.firstSeen.get(key)!;
  };
  const newLegendaries = new Map<string, string[]>();
  for (const p of live.allPlayers) {
    const k = pkey(p);
    const cur = new Set(p.items.map((i) => String(i.itemID)).filter((id) => isLegendary(patch, id)));
    const prev = memory.legendaries.get(k);
    if (memory.initialized && prev) {
      const added = [...cur].filter((id) => !prev.has(id));
      if (added.length) newLegendaries.set(k, added);
    }
    memory.legendaries.set(k, cur);
  }
  for (const [k, ids] of newLegendaries) for (const id of ids) memory.firstSeen.set(`spike:${k}:${id}`, now);
  memory.initialized = true;

  // --- 1. recent event -----------------------------------------------------
  const ev = ctx.lastEvent;
  if (ev && now - ev.EventTime <= 25) {
    if (ev.EventName === "ChampionKill") {
      const victim = findPlayerByName(live, ev.VictimName);
      const killer = findPlayerByName(live, ev.KillerName);
      if (victim && samePlayer(victim, me)) {
        if (ctx.deathsStreak >= 2) add("death-streak", "crit", "tip.death_streak", { n: ctx.deathsStreak }, 5);
        else add("death", "warn", "tip.death", { killer: killer ? nameOf(killer) : String(ev.KillerName ?? "?") }, 2);
      } else if (killer && samePlayer(killer, me)) {
        add("kill", "info", "tip.kill", {}, 2);
      }
    }
    const objKind =
      ev.EventName === "DragonKill" ? "dragon" : ev.EventName === "BaronKill" ? "baron" : ev.EventName === "HeraldKill" ? "herald" : null;
    if (objKind) {
      const killer = findPlayerByName(live, ev.KillerName);
      const obj = tx(lang, `obj.name.${objKind}`);
      if (killer && killer.team === me.team) add(`obj-won-${ev.EventID}`, "info", "tip.obj_won", { obj }, 1);
      else add(`obj-lost-${ev.EventID}`, "warn", "tip.obj_lost", { obj }, 2);
    }
  }

  // --- 2. lane matchup: CS and level 6 -------------------------------------
  const opp = laneOpponent(live, patch, role);
  if (opp && now >= 180 && now < 20 * 60 && role !== "UTILITY") {
    const d = (me.scores?.creepScore ?? 0) - (opp.scores?.creepScore ?? 0);
    if (d <= -15) add("cs-behind", "warn", "tip.cs_behind", { d: -d, opp: nameOf(opp) }, 3);
    else if (d >= 20) add("cs-ahead", "info", "tip.cs_ahead", { d, opp: nameOf(opp) }, 2);
  }
  if (opp && now < 15 * 60) {
    if (me.level >= 6 && opp.level < 6) add("lvl6-me", "crit", "tip.lvl6_me", { opp: nameOf(opp) }, 4);
    else if (opp.level >= 6 && me.level < 6) add("lvl6-opp", "warn", "tip.lvl6_opp", { opp: nameOf(opp) }, 4);
  }

  // --- 3. numbers / enemy jungler dead -------------------------------------
  const st = objectiveState(live, patch);
  if (st.enemiesDead.length >= 2 && !me.isDead) {
    const t = Math.min(...st.enemiesDead.map((e) => e.t));
    add("numbers", "crit", "tip.numbers", { n: st.enemiesDead.length, t }, 6);
  } else if (st.enemyJunglerDead && st.enemyJunglerDead.t >= 15 && now >= 180) {
    add("jg-dead", "info", "tip.jg_dead", { champ: st.enemyJunglerDead.name, t: st.enemyJunglerDead.t }, 3);
  }

  // --- 4. enemy defensive items (shown for 90s after first seen) -----------
  for (const e of enemies) {
    for (const inv of e.items) {
      const id = String(inv.itemID);
      const kind = DEFENSIVE[id];
      if (!kind) continue;
      const key = `def:${pkey(e)}:${id}`;
      if (now - seenNow(key) <= 90) {
        add(key, "warn", `tip.def.${kind}`, { champ: nameOf(e), item: itemName(id) }, 3);
      }
    }
  }

  // --- 5. anti-heal component early ----------------------------------------
  const threat = computeThreat(live, patch);
  const myIds = new Set(me.items.map((i) => String(i.itemID)));
  // One healing support is normal; tip only for a real healing comp.
  if (threat.healWeight >= 0.75 && phase !== "late" && ![...myIds].some((id) => ANTI_HEAL.has(id))) {
    const arch = archetypeOf(champOf(me, patch), role);
    const comp =
      arch === "mage" || arch === "apFighter" || arch === "mageSupport" || arch === "enchanter"
        ? "3916"
        : arch === "tank" || arch === "tankSupport"
          ? "3076"
          : "3123";
    if (patch.item.data[comp]) {
      add("antiheal", "info", "tip.antiheal", { item: itemName(comp), names: threat.by.heal.slice(0, 2).join(", ") }, 2);
    }
  }

  // --- 6. item spikes (mine and lane opponent), 60s window ------------------
  for (const id of memory.legendaries.get(pkey(me)) ?? []) {
    const at = memory.firstSeen.get(`spike:${pkey(me)}:${id}`);
    if (at !== undefined && now - at <= 60) add(`my-spike-${id}`, "info", "tip.my_spike", { item: itemName(id) }, 3);
  }
  if (opp) {
    for (const id of memory.legendaries.get(pkey(opp)) ?? []) {
      const at = memory.firstSeen.get(`spike:${pkey(opp)}:${id}`);
      if (at !== undefined && now - at <= 60) {
        add(`opp-spike-${id}`, "warn", "tip.opp_spike", { opp: nameOf(opp), item: itemName(id) }, 3);
      }
    }
  }

  // --- 7. you are the fed target (late) ------------------------------------
  if (now >= 20 * 60) {
    const value = (p: PlayerShort) => p.items.reduce((s, i) => s + (i.price ?? 0), 0);
    const mine = value(me);
    const others = allies.filter((p) => !samePlayer(p, me)).map(value);
    if (others.length && others.every((v) => mine >= v + 1500)) add("target", "warn", "tip.target", {}, 2);
  }

  tips.sort((a, b) => SEV[b.severity] - SEV[a.severity] || (b.prio ?? 0) - (a.prio ?? 0));
  return tips;
}
