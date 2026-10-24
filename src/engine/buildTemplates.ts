// Build order templates.
//
// Source priority in the recommender:
//   1. An item set the League client already has for this champion
//      (Blitz and similar apps write these; read via LCU / Config folder).
//      This is the closest thing to "the current meta build" without
//      scraping anyone.
//   2. These templates (fallback), one per archetype, with a few
//      per-champion overrides.
//
// Every ID here was checked against Data Dragon 16.21.1 (pt_BR). At runtime
// each ID is validated again against the loaded patch; unknown or
// non-purchasable IDs are skipped with a log line, never shown.
//
// `order` uses "BOOTS" as a slot. Marksmen and mages finish the first item
// before tier 2 boots (that is also what the Blitz screenshot shows for
// Caitlyn: boots are the 5th entry of "Ordem da Build", after the first
// legendary).

import type { Champion, Role } from "@/types";

export type Archetype =
  | "marksman"
  | "mage"
  | "assassin"
  | "fighter"
  | "apFighter"
  | "tank"
  | "enchanter"
  | "tankSupport"
  | "mageSupport";

export type Threat = "heal" | "shields" | "apBurst" | "adBurst" | "crit" | "tanks" | "cc";

export interface BuildTemplate {
  start: string[];
  core: string[]; // legendaries in order
  boots: string; // default tier 2 boots
  bootsAfter: number; // number of core items before the boots slot
  situational: Partial<Record<Threat, string[]>>;
}

const T: Record<Archetype, BuildTemplate> = {
  marksman: {
    start: ["1055", "2003"], // Doran's Blade + Health Potion
    core: ["3032", "3031", "3036", "3072", "3026"], // Yun Tal, IE, LDR, BT, GA
    boots: "3006", // Berserker's Greaves
    bootsAfter: 1,
    situational: {
      heal: ["3033"], // Mortal Reminder
      tanks: ["3036", "3033"],
      apBurst: ["3156", "3139"], // Maw, Mercurial
      adBurst: ["3026", "6673"], // GA, Shieldbow
      cc: ["3139"],
    },
  },
  mage: {
    start: ["1056", "2003"], // Doran's Ring
    core: ["6655", "4645", "3089", "3135", "3157"], // Luden's, Shadowflame, Rabadon, Void, Zhonya
    boots: "3020",
    bootsAfter: 1,
    situational: {
      heal: ["3165"], // Morellonomicon
      adBurst: ["3157"],
      apBurst: ["3102"], // Banshee's
      tanks: ["3135", "6653"], // Void Staff, Liandry's
    },
  },
  assassin: {
    start: ["1055", "2003"],
    core: ["6698", "3142", "6694", "3814", "3036"], // Profane, Youmuu, Serylda, EoN, LDR
    boots: "3158",
    bootsAfter: 1,
    situational: {
      heal: ["6609"], // Chempunk
      shields: ["6695"], // Serpent's Fang
      apBurst: ["3814", "3156"],
      cc: ["3814"],
      tanks: ["6694"],
    },
  },
  fighter: {
    start: ["1055", "2003"],
    core: ["3071", "3053", "6333", "3065", "3026"], // Cleaver, Sterak's, DD, Visage, GA
    boots: "3047",
    bootsAfter: 1,
    situational: {
      heal: ["6609"],
      apBurst: ["3156", "3065"],
      tanks: ["3071"],
    },
  },
  apFighter: {
    start: ["1054", "2003"], // Doran's Shield
    core: ["4633", "6653", "3116", "3157", "3135"], // Riftmaker, Liandry, Rylai, Zhonya, Void
    boots: "3047",
    bootsAfter: 1,
    situational: {
      heal: ["3165"],
      adBurst: ["3157"],
      tanks: ["3135"],
    },
  },
  tank: {
    start: ["1054", "2003"],
    core: ["3068", "6665", "2504", "3075", "3143"], // Sunfire, Jak'Sho, Kaenic, Thornmail, Randuin
    boots: "3047",
    bootsAfter: 1,
    situational: {
      heal: ["3075"],
      crit: ["3143"],
      apBurst: ["4401", "2504"], // Force of Nature, Kaenic
      // vs CC: Mercury's Treads, chosen in the boots slot (pickBoots)
    },
  },
  enchanter: {
    start: ["3865", "2003"], // World Atlas
    core: ["6617", "3504", "6616", "3107", "3222"], // Moonstone, Ardent, Flowing Water, Redemption, Mikael
    boots: "3158",
    bootsAfter: 1,
    situational: {
      cc: ["3222"],
      apBurst: ["3190"], // Locket
    },
  },
  tankSupport: {
    start: ["3865", "2003"],
    core: ["3190", "3109", "3050", "2502", "3143"], // Locket, Knight's Vow, Zeke's, Unending Despair, Randuin
    boots: "3047",
    bootsAfter: 1,
    situational: {
      heal: ["3075"],
      crit: ["3143"],
      apBurst: ["4401"],
    },
  },
  mageSupport: {
    start: ["3865", "2003"],
    core: ["6653", "3165", "3116", "3157", "4645"], // Liandry, Morello, Rylai, Zhonya, Shadowflame
    boots: "3020",
    bootsAfter: 1,
    situational: {
      heal: ["3165"],
      adBurst: ["3157"],
    },
  },
};

// Per-champion core overrides (start/boots/situational come from archetype).
const CORE_OVERRIDE: Record<string, string[]> = {
  Caitlyn: ["3032", "3031", "3094", "3036", "3072"], // Yun Tal, IE, Rapid Firecannon, LDR, BT
  Jhin: ["6676", "3031", "3094", "3036", "3072"], // Collector, IE, RFC, LDR, BT
};

const JUNGLE_PET: Record<Archetype, string> = {
  marksman: "1102", // Gustwalker
  mage: "1102",
  assassin: "1101", // Scorchclaw
  fighter: "1101",
  apFighter: "1103", // Mosstomper
  tank: "1103",
  enchanter: "1102",
  tankSupport: "1103",
  mageSupport: "1102",
};

export function archetypeOf(c: Champion | null, role: Role): Archetype {
  const tags = c?.tags ?? [];
  const primary = tags[0];
  const apLeaning = (c?.info.magic ?? 0) > (c?.info.attack ?? 0);

  if (role === "UTILITY") {
    if (primary === "Tank" || primary === "Fighter") return "tankSupport";
    if (primary === "Mage" && !tags.includes("Support")) return "mageSupport";
    if (primary === "Support" || tags.includes("Support")) return "enchanter";
    return "enchanter";
  }
  if (primary === "Marksman") return "marksman";
  if (primary === "Mage") return "mage";
  if (primary === "Assassin") return apLeaning ? "mage" : "assassin";
  if (primary === "Fighter") return apLeaning ? "apFighter" : "fighter";
  if (primary === "Tank") return "tank";
  if (primary === "Support") return "enchanter";
  return "fighter";
}

export function templateFor(c: Champion | null, role: Role): BuildTemplate & { archetype: Archetype } {
  const archetype = archetypeOf(c, role);
  const base = T[archetype];
  const core = (c && CORE_OVERRIDE[c.id]) || base.core;
  const start = role === "JUNGLE" ? [JUNGLE_PET[archetype], "2003"] : base.start;
  return { ...base, core, start, archetype };
}
