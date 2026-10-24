// recommendNextItem: the NEXT step of a build order, never a random
// high-score item.
//
//   start -> core 1 -> tier 2 boots -> core 2 -> (situational) -> core 3...
//
// Build order source:
//   1. item set the League client has for this champion (Blitz etc.)
//   2. archetype template (buildTemplates.ts)
// Situational items are inserted by the enemy threat profile: after core 2
// when the threat is strong (>= 0.7), after core 3 when moderate (>= 0.55).
//
// Prices follow the shop exactly (items.ts costWithPool): owned recipe parts
// are discounted, starters like Doran's Blade are NOT (they build into
// nothing, so the shop gives no discount for them either).

import type {
  BuildSource,
  BuildStage,
  ClientItemSet,
  ItemRecommendation,
  Lang,
  LiveSnapshot,
  PatchData,
  Role,
} from "@/types";
import { tx } from "@/i18n";
import { champOf, teams } from "./role";
import { computeThreat, type ThreatProfile } from "./threatAnalysis";
import { templateFor, type Threat } from "./buildTemplates";
import {
  bootsTier,
  buyNowPlan,
  effectiveCost,
  isJungleItem,
  isLegendary,
  isStarter,
  isT2Boots,
  itemIcon,
  srItem,
} from "./items";

export interface RecommendCtx {
  live: LiveSnapshot;
  patch: PatchData;
  role: Role;
  lang: Lang;
  clientSet: ClientItemSet | null;
}

interface Plan {
  start: string[];
  core: string[];
  boots: string | null;
  bootsAfter: number;
  source: BuildSource;
  sourceTitle?: string;
}

const warned = new Set<string>();
function warnOnce(key: string, msg: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(msg);
}

export function planFromClientSet(set: ClientItemSet | null, patch: PatchData): Plan | null {
  if (!set) return null;
  const seen = new Set<string>();
  const start: string[] = [];
  const core: string[] = [];
  let boots: string | null = null;
  let bootsAfter = 1;
  set.blocks.forEach((b, bi) => {
    for (const id of b.items) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (bi === 0 && isStarter(patch, id)) start.push(id);
      else if (isT2Boots(patch, id)) {
        if (!boots) {
          boots = id;
          bootsAfter = core.length;
        }
      } else if (isLegendary(patch, id)) core.push(id);
    }
  });
  if (core.length < 2) return null;
  return { start, core: core.slice(0, 6), boots, bootsAfter, source: "client", sourceTitle: set.title };
}

const THREAT_ORDER: Threat[] = ["heal", "shields", "apBurst", "adBurst", "crit", "tanks", "cc"];

function strongestThreat(
  threat: ThreatProfile,
  candidates: Partial<Record<Threat, string[]>>,
  owned: Set<string>,
  patch: PatchData,
  min: number
): { threat: Threat; id: string } | null {
  let best: { threat: Threat; id: string; w: number } | null = null;
  for (const th of THREAT_ORDER) {
    const w = threat.score[th];
    if (w < min) continue;
    const id = (candidates[th] ?? []).find((x) => isLegendary(patch, x) && !owned.has(x));
    if (!id) continue;
    if (!best || w > best.w) best = { threat: th, id, w };
  }
  return best ? { threat: best.threat, id: best.id } : null;
}

function pickBoots(defaultId: string, threat: ThreatProfile, archetype: string): string {
  // Marksmen and mages keep their damage boots; everyone else adapts.
  if (archetype === "marksman" || archetype === "mage" || archetype === "mageSupport") return defaultId;
  if (threat.apWeight >= 0.55 || threat.ccWeight >= 0.6) return "3111"; // Mercury's Treads
  if (threat.adWeight >= 0.6) return "3047"; // Plated Steelcaps
  return defaultId;
}

export function recommendNextItem(ctx: RecommendCtx): ItemRecommendation | null {
  const { live, patch, role, lang } = ctx;
  const { me, enemies } = teams(live);
  if (!me) return null;

  const gold = live.activePlayer.currentGold ?? 0;
  const inv = me.items ?? [];
  const owned = new Set(inv.map((i) => String(i.itemID)));
  const champ = champOf(me, patch);
  const tpl = templateFor(champ, role);
  const threat = computeThreat(live, patch);
  const champName = champ?.name ?? me.championName;

  const clientPlan = planFromClientSet(ctx.clientSet, patch);
  const plan: Plan = clientPlan ?? {
    start: tpl.start,
    core: tpl.core,
    boots: null,
    bootsAfter: tpl.bootsAfter,
    source: "template",
  };

  const core = plan.core.filter((id) => {
    if (isLegendary(patch, id)) return true;
    warnOnce(`core-${id}`, `[recommender] item ${id} is not a purchasable legendary in ${patch.version}; skipped`);
    return false;
  });
  const start = plan.start.filter((id) => {
    const it = srItem(patch, id);
    if (!it || !isStarter(patch, id)) return false;
    if (role !== "JUNGLE" && isJungleItem(it)) return false; // Smite items only for junglers
    return true;
  });
  let bootsId = plan.boots ?? pickBoots(tpl.boots, threat, tpl.archetype);
  if (!isT2Boots(patch, bootsId)) {
    warnOnce(`boots-${bootsId}`, `[recommender] boots ${bootsId} invalid in ${patch.version}`);
    bootsId = "";
  }

  const base = {
    patch,
    inv,
    gold,
    lang,
    source: plan.source,
    sourceTitle: plan.sourceTitle,
  };

  // --- 1. Starting items (first 90s, nothing bought yet). ----------------
  const t = live.gameData.gameTime ?? 0;
  const boughtSomething = inv.some((i) => {
    const it = patch.item.data[String(i.itemID)];
    return it && !it.tags?.includes("Trinket") && !it.consumed && (it.gold?.total ?? 0) >= 300;
  });
  if (t < 90 && !boughtSomething && start.length) {
    const id = start.find((s) => !owned.has(s) && !patch.item.data[s]?.consumed) ?? start[0];
    return build(base, id, "start", 0, "reason.start", { champ: champName });
  }

  // --- 2. Walk the build order. ------------------------------------------
  const hasUpgradedBoots = inv.some((i) => bootsTier(patch, String(i.itemID)) >= 2);
  const ownedLegendaries = inv.filter((i) => isLegendary(patch, String(i.itemID))).length;

  // Sequence with the boots slot and an optional situational slot.
  type Slot = { kind: "core"; id: string } | { kind: "boots" } | { kind: "sit"; id: string; threat: Threat };
  const seq: Slot[] = core.map((id) => ({ kind: "core" as const, id }));
  if (bootsId) seq.splice(Math.min(plan.bootsAfter, seq.length), 0, { kind: "boots" });

  const sit =
    strongestThreat(threat, tpl.situational, owned, patch, 0.7) ??
    strongestThreat(threat, tpl.situational, owned, patch, 0.55);
  if (sit && !core.includes(sit.id)) {
    const strong = threat.score[sit.threat] >= 0.7;
    const afterCore = strong ? 2 : 3;
    // Insert after the Nth core entry.
    let seen = 0;
    let at = seq.length;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i].kind === "core") seen += 1;
      if (seen === afterCore) {
        at = i + 1;
        break;
      }
    }
    seq.splice(at, 0, { kind: "sit", id: sit.id, threat: sit.threat });
  }

  // Legendaries bought outside the plan fill the earliest open core slots,
  // so a player who went another first item is not told to buy a second
  // "first item".
  let offPlanCredits = ownedLegendaries - core.filter((c) => owned.has(c)).length;

  let legendaryStep = 0;
  for (const slot of seq) {
    if (slot.kind === "boots") {
      if (hasUpgradedBoots) continue;
      return build(base, bootsId, "boots", 0, "reason.boots", { champ: champName });
    }
    legendaryStep += 1;
    if (owned.has(slot.id)) continue;
    if (slot.kind === "core" && offPlanCredits > 0) {
      offPlanCredits -= 1;
      continue;
    }
    if (slot.kind === "sit") {
      return build(base, slot.id, "situational", legendaryStep, `reason.sit.${slot.threat}`, {
        names: threat.by[slot.threat].slice(0, 2).join(", "),
      });
    }
    return build(base, slot.id, "core", legendaryStep, "reason.core", {
      n: legendaryStep,
      champ: champName,
    });
  }

  // --- 3. Build complete: best remaining answer to the enemy comp. --------
  const late = strongestThreat(threat, tpl.situational, owned, patch, 0.3);
  if (late) {
    return build({ ...base, source: "threat" }, late.id, "situational", legendaryStep + 1, `reason.sit.${late.threat}`, {
      names: threat.by[late.threat].slice(0, 2).join(", "),
    });
  }
  return null;
}

function build(
  b: {
    patch: PatchData;
    inv: LiveSnapshot["allPlayers"][number]["items"];
    gold: number;
    lang: Lang;
    source: BuildSource;
    sourceTitle?: string;
  },
  id: string,
  stage: BuildStage,
  step: number,
  reasonKey: string,
  vars: Record<string, string | number>
): ItemRecommendation {
  const { patch, inv, gold, lang } = b;
  const it = patch.item.data[id];
  const eff = effectiveCost(patch, id, inv);
  const plan = eff > gold ? buyNowPlan(patch, id, inv, gold) : [];
  return {
    itemId: Number(id),
    name: it?.name ?? `#${id}`,
    iconUrl: itemIcon(patch, id),
    reason: tx(lang, reasonKey, vars),
    stage,
    step,
    source: b.source,
    sourceTitle: b.sourceTitle,
    gold: it?.gold?.total ?? 0,
    effectiveCost: eff,
    goldRemaining: Math.max(0, eff - gold),
    canAffordNow: gold >= eff,
    buyNow: plan.map((p) => ({
      itemId: Number(p.id),
      name: patch.item.data[p.id]?.name ?? p.id,
      iconUrl: itemIcon(patch, p.id),
      cost: p.cost,
    })),
  };
}
