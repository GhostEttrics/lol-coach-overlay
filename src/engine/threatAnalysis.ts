// Threat profile of the enemy team, data-driven from Data Dragon.
//
// Damage type comes from champion info (magic vs attack), not from a
// hand-written list, so new champions (e.g. Zaahen) are covered on day one.
// Heal and shield users still need a short list: Data Dragon has no tag for
// "this kit heals".

import type { LiveSnapshot, PatchData, PlayerShort } from "@/types";
import type { Threat } from "./buildTemplates";
import { champOf, teams } from "./role";

export interface ThreatProfile {
  adWeight: number;
  apWeight: number;
  burstWeight: number;
  healWeight: number;
  shieldWeight: number;
  frontlineWeight: number;
  critWeight: number;
  ccWeight: number;
  // Situational score per threat (0..1) and which enemies cause it.
  score: Record<Threat, number>;
  by: Record<Threat, string[]>;
}

const HEALERS = new Set([
  "Soraka", "Yuumi", "Nami", "Sona", "Milio", "Vladimir", "Aatrox", "DrMundo",
  "Warwick", "Illaoi", "Fiora", "Sylas", "Swain", "Olaf", "Trundle", "Volibear",
  "Briar", "Seraphine", "Senna", "Gwen", "Kayn", "Yorick", "Maokai",
]);
const SHIELDERS = new Set([
  "Lulu", "Janna", "Karma", "Lux", "Morgana", "Orianna", "Taric", "Yasuo",
  "Riven", "Milio", "Seraphine", "Renata", "Ivern", "Rakan", "Sona", "Sett",
]);

const clamp = (x: number) => Math.max(0, Math.min(1, x));

export function computeThreat(live: LiveSnapshot, patch: PatchData): ThreatProfile {
  const { enemies } = teams(live);
  return computeThreatFor(enemies, patch);
}

export function computeThreatFor(enemies: PlayerShort[], patch: PatchData): ThreatProfile {
  let ad = 0, ap = 0, burst = 0, heal = 0, shield = 0, front = 0, crit = 0, cc = 0;
  let apBurst = 0, adBurst = 0;
  const by: Record<Threat, string[]> = {
    heal: [], shields: [], apBurst: [], adBurst: [], crit: [], tanks: [], cc: [],
  };

  for (const e of enemies) {
    const c = champOf(e, patch);
    const name = c?.name ?? e.championName;
    const id = c?.id ?? "";
    const tags = c?.tags ?? [];
    const magic = c?.info.magic ?? 0;
    const attack = c?.info.attack ?? 0;
    const apLean = magic > attack;

    if (apLean) ap += 1;
    else ad += 1;

    const isBurst = tags.includes("Assassin") || (tags[0] === "Mage" && magic >= 8);
    if (isBurst) {
      burst += 1;
      if (apLean) { apBurst += 1; by.apBurst.push(name); }
      else { adBurst += 1; by.adBurst.push(name); }
    } else if (apLean && magic >= 7) {
      apBurst += 0.5;
      by.apBurst.push(name);
    } else if (!apLean && tags[0] === "Fighter" && attack >= 8) {
      adBurst += 0.5;
      by.adBurst.push(name);
    }

    if (tags.includes("Tank") || (tags[0] === "Fighter" && (c?.info.defense ?? 0) >= 5)) {
      front += tags.includes("Tank") ? 1 : 0.5;
      by.tanks.push(name);
    }
    if (tags.includes("Tank") || tags.includes("Support")) {
      cc += tags.includes("Tank") ? 1 : 0.6;
      by.cc.push(name);
    }
    if (HEALERS.has(id)) { heal += 1; by.heal.push(name); }
    if (SHIELDERS.has(id)) { shield += 1; by.shields.push(name); }
    if (tags[0] === "Marksman") { crit += 0.5; by.crit.push(name); }

    for (const inv of e.items ?? []) {
      const it = patch.item.data[String(inv.itemID)];
      if (!it || (it.gold?.total ?? 0) < 1000) continue;
      const t = it.tags ?? [];
      if (t.includes("LifeSteal") || t.includes("SpellVamp")) heal += 0.3;
      if (t.includes("CriticalStrike")) crit += 0.3;
      if (t.includes("SpellDamage")) ap += 0.15;
      if (t.includes("Damage")) ad += 0.15;
      if (t.includes("Armor") && t.includes("Health")) front += 0.2;
    }
  }

  const total = Math.max(1, ad + ap);
  const profile: ThreatProfile = {
    adWeight: clamp(ad / total),
    apWeight: clamp(ap / total),
    burstWeight: clamp(burst / 2),
    healWeight: clamp(heal / 2),
    shieldWeight: clamp(shield / 2),
    frontlineWeight: clamp(front / 2.5),
    critWeight: clamp(crit / 1.2),
    ccWeight: clamp(cc / 2.5),
    score: {} as Record<Threat, number>,
    by,
  };
  profile.score = {
    heal: profile.healWeight,
    shields: profile.shieldWeight,
    apBurst: clamp(apBurst / 1.5),
    adBurst: clamp(adBurst / 1.5),
    crit: profile.critWeight,
    tanks: profile.frontlineWeight,
    cc: profile.ccWeight,
  };
  return profile;
}
