// Objective state and the ONE objective call worth showing.
//
// The game HUD already shows spawn timers, so a bare "Dragão 0:42" adds
// nothing. This module only speaks when an objective is up or within 75s,
// and always pairs it with an action based on numbers, soul state, the enemy
// jungler and the player's role.
//
// Spawn times live in SPAWN so a season change is a one-line fix.

import type { LiveSnapshot, ObjectiveCall, Lang, PatchData, Role } from "@/types";
import { tx } from "@/i18n";
import { champOf, enemyJungler, findPlayerByName, teams } from "./role";

export const SPAWN = {
  dragonFirst: 300,
  dragonRespawn: 300,
  elderRespawn: 360,
  baronFirst: 1500,
  baronRespawn: 360,
  heraldFirst: 840,
};

const CALL_WINDOW = 75;

export interface ObjectiveState {
  now: number;
  myDragons: number;
  enemyDragons: number;
  soulTeam: "me" | "enemy" | null;
  dragonIn: number;
  baronIn: number;
  heraldIn: number | null;
  alliesAlive: number;
  enemiesAlive: number;
  enemiesDead: { name: string; t: number }[];
  enemyJunglerDead: { name: string; t: number } | null;
}

export function objectiveState(live: LiveSnapshot, patch: PatchData | null): ObjectiveState {
  const { me, allies, enemies } = teams(live);
  const now = live.gameData.gameTime ?? 0;
  const events = live.events?.Events ?? [];

  let myDragons = 0;
  let enemyDragons = 0;
  let lastDragonAt: number | null = null;
  let lastBaronAt: number | null = null;
  let heraldTaken = false;

  for (const e of events) {
    if (e.EventName === "DragonKill") {
      const elder = String(e.DragonType ?? "").toLowerCase() === "elder";
      const killer = findPlayerByName(live, e.KillerName);
      if (!elder && killer && me) {
        if (killer.team === me.team) myDragons += 1;
        else enemyDragons += 1;
      }
      lastDragonAt = e.EventTime;
    } else if (e.EventName === "BaronKill") {
      lastBaronAt = e.EventTime;
    } else if (e.EventName === "HeraldKill") {
      heraldTaken = true;
    }
  }

  const soulTeam = myDragons >= 4 ? "me" : enemyDragons >= 4 ? "enemy" : null;
  const dragonIn =
    lastDragonAt === null
      ? Math.max(0, SPAWN.dragonFirst - now)
      : Math.max(0, lastDragonAt + (soulTeam ? SPAWN.elderRespawn : SPAWN.dragonRespawn) - now);
  const baronIn =
    lastBaronAt === null
      ? Math.max(0, SPAWN.baronFirst - now)
      : Math.max(0, lastBaronAt + SPAWN.baronRespawn - now);
  const heraldIn =
    heraldTaken || now > SPAWN.baronFirst - 60 ? null : Math.max(0, SPAWN.heraldFirst - now);

  const enemiesDead = enemies
    .filter((p) => p.isDead && p.respawnTimer >= 8)
    .map((p) => ({ name: champOf(p, patch)?.name ?? p.championName, t: Math.round(p.respawnTimer) }));

  const jg = enemyJungler(live, patch);
  const enemyJunglerDead =
    jg && jg.isDead && jg.respawnTimer >= 10
      ? { name: champOf(jg, patch)?.name ?? jg.championName, t: Math.round(jg.respawnTimer) }
      : null;

  return {
    now,
    myDragons,
    enemyDragons,
    soulTeam,
    dragonIn,
    baronIn,
    heraldIn,
    alliesAlive: allies.filter((p) => !p.isDead).length,
    enemiesAlive: enemies.filter((p) => !p.isDead).length,
    enemiesDead,
    enemyJunglerDead,
  };
}

export function fmtTime(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function objectiveCall(st: ObjectiveState, role: Role, lang: Lang): ObjectiveCall | null {
  type Cand = { kind: ObjectiveCall["kind"]; t: number };
  const cands: Cand[] = [{ kind: st.soulTeam ? "elder" : "dragon", t: st.dragonIn }];
  if (st.now >= SPAWN.baronFirst - CALL_WINDOW) cands.push({ kind: "baron", t: st.baronIn });
  if (st.heraldIn !== null) cands.push({ kind: "herald", t: st.heraldIn });

  const next = cands.filter((c) => c.t <= CALL_WINDOW).sort((a, b) => a.t - b.t)[0];
  if (!next) return null;

  const obj = tx(lang, `obj.name.${next.kind}`);
  const when = next.t <= 0 ? tx(lang, "obj.when.up") : tx(lang, "obj.when.in", { t: fmtTime(next.t) });
  const adv = st.alliesAlive - st.enemiesAlive;
  const base = { kind: next.kind, secondsLeft: next.t };

  if (adv >= 2) {
    return { ...base, severity: "crit", text: tx(lang, "obj.take_now", { obj, when, n: st.enemiesDead.length }) };
  }
  if (adv <= -2) {
    return {
      ...base,
      severity: "warn",
      text: tx(lang, "obj.give", { obj, when, a: st.alliesAlive, b: st.enemiesAlive }),
    };
  }
  if (st.enemyJunglerDead && next.kind !== "baron") {
    return { ...base, severity: "crit", text: tx(lang, "obj.jg_dead", { obj, when, t: st.enemyJunglerDead.t }) };
  }
  if (next.kind === "elder") {
    return { ...base, severity: "crit", text: tx(lang, "obj.elder", { obj, when }) };
  }
  if (next.kind === "dragon" && st.enemyDragons === 3) {
    return { ...base, severity: "crit", text: tx(lang, "obj.enemy_soul", { obj, when }) };
  }
  if (next.kind === "dragon" && st.myDragons === 3) {
    return { ...base, severity: "warn", text: tx(lang, "obj.my_soul", { obj, when }) };
  }

  let key = `obj.prep.${role}`;
  if (role === "TOP" && next.kind === "herald") key = "obj.prep.TOP_herald";
  if (role === "BOTTOM" && next.kind !== "dragon") key = "obj.prep.BOTTOM_far";
  return { ...base, severity: "info", text: tx(lang, key, { obj, when }) };
}
