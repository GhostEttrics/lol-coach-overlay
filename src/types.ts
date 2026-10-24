// Shared types for the overlay and engine.

export type Lang = "pt-BR" | "en";
export type Theme = "dark" | "light";
export type DetailLevel = "low" | "medium" | "high";

export interface UserSettings {
  theme: Theme;
  lang: Lang;
  detail_level: DetailLevel;
  pool: Partial<Record<Role, string[]>>;
  automation: Automation;
  overlay: OverlaySettings;
  // Last role the user played or picked in draft. Used only when the client
  // does not assign a position (bot games, blind pick, customs).
  last_role?: Role | null;
  // Panel card id -> enabled. A missing id means enabled.
  panel_cards: Record<string, boolean>;
  notify: Notify;
}

export interface Notify {
  sound_affordable: boolean;
  voice: boolean;
}

export type OverlayCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface Automation {
  auto_accept: boolean;
  auto_import_runes: boolean;
  auto_buy: boolean;
  elo_filter: string | null;
  queue_timeout_s: number | null;
}

export interface OverlaySettings {
  click_through: boolean;
  position: [number, number] | null;
  minimized: boolean;
  silent: boolean;
  scale: number;
  corner: OverlayCorner;
}

export type Role = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
export const ROLES: Role[] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
export type Phase = "early" | "mid" | "late";
export type Tempo = "ahead" | "even" | "behind";

// Where the role came from. Shown in the overlay so a wrong role is visible.
export type RoleSource = "override" | "game" | "draft" | "inferred";

// Live Client Data API shape (trimmed to fields we use).
export interface LiveSnapshot {
  activePlayer: ActivePlayer;
  allPlayers: PlayerShort[];
  events: { Events: GameEvent[] };
  gameData: { gameTime: number; gameMode: string; mapName: string };
}

export interface ActivePlayer {
  summonerName: string;
  riotId?: string;
  riotIdGameName?: string;
  currentGold: number;
  level: number;
  championStats: ChampionStats;
  abilities: AbilityPage;
  fullRunes: unknown;
}

export interface ChampionStats {
  armor: number;
  magicResist: number;
  attackDamage: number;
  abilityPower: number;
  maxHealth: number;
  currentHealth: number;
  resourceValue: number;
  resourceMax: number;
  moveSpeed: number;
  critChance: number;
  attackSpeed: number;
  lifeSteal: number;
  omnivamp: number;
  physicalLethality: number;
  magicPenetrationFlat: number;
  magicPenetrationPercent: number;
  armorPenetrationFlat: number;
  armorPenetrationPercent: number;
}

export interface AbilityPage {
  Q: Ability;
  W: Ability;
  E: Ability;
  R: Ability;
  Passive: Ability;
}

export interface Ability {
  abilityLevel: number;
  displayName: string;
  id: string;
  rawDescription: string;
  rawDisplayName: string;
}

export interface SpellRef {
  displayName: string;
  rawDisplayName?: string;
}

export interface PlayerShort {
  summonerName: string;
  riotId?: string;
  riotIdGameName?: string;
  championName: string;
  rawChampionName: string;
  team: "ORDER" | "CHAOS";
  // Live Client sends "" in bot games, ARAM and some customs.
  position: string;
  level: number;
  isDead: boolean;
  isBot?: boolean;
  respawnTimer: number;
  scores: { kills: number; deaths: number; assists: number; creepScore: number; wardScore: number };
  items: InventoryItem[];
  summonerSpells: { summonerSpellOne: SpellRef; summonerSpellTwo: SpellRef };
  runes: unknown;
}

export interface InventoryItem {
  canUse: boolean;
  consumable: boolean;
  count: number;
  displayName: string;
  itemID: number;
  price: number;
  rawDescription: string;
  rawDisplayName: string;
  slot: number;
}

export interface GameEvent {
  EventID: number;
  EventName: string;
  EventTime: number;
  [k: string]: unknown;
}

// Data Dragon types (trimmed).
export interface PatchData {
  version: string;
  locale: string;
  cdn: string;
  champion: { data: Record<string, Champion> };
  item: { data: Record<string, Item> };
  runes: RuneTree[];
  summoner: { data: Record<string, SummonerSpell> };
}

export interface Champion {
  id: string;
  key: string;
  name: string;
  title: string;
  image: { full: string };
  tags: string[];
  info: { attack: number; defense: number; magic: number; difficulty: number };
}

export interface Item {
  name: string;
  description: string;
  plaintext: string;
  from?: string[];
  into?: string[];
  image: { full: string };
  gold: { total: number; base: number; sell: number; purchasable: boolean };
  stats: Record<string, number>;
  tags: string[];
  maps: Record<string, boolean>;
  depth?: number;
  inStore?: boolean;
  hideFromAll?: boolean;
  requiredChampion?: string;
  requiredAlly?: string;
  specialRecipe?: number;
  consumed?: boolean;
}

export interface RuneTree {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: { runes: Rune[] }[];
}

export interface Rune {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
}

export interface SummonerSpell {
  id: string;
  name: string;
  description: string;
  key: string;
  image: { full: string };
}

// Item set read from the League client (Blitz and similar tools write these).
export interface ClientItemSet {
  title: string;
  source: "lcu" | "file";
  champion: string; // Data Dragon id, e.g. "Caitlyn"
  blocks: { type: string; items: string[] }[];
}

// Engine outputs.
export type BuildStage = "start" | "core" | "boots" | "situational";
export type BuildSource = "client" | "template" | "threat";

export interface ItemRecommendation {
  itemId: number;
  name: string;
  iconUrl: string;
  reason: string; // already translated
  stage: BuildStage;
  step: number; // 1-based legendary index; 0 for start/boots
  source: BuildSource;
  sourceTitle?: string;
  gold: number; // full item total in the shop
  effectiveCost: number; // what it costs YOU, after owned recipe parts
  goldRemaining: number; // effectiveCost - current gold, never negative
  canAffordNow: boolean;
  // Parts you can buy right now on the way to the target.
  buyNow: { itemId: number; name: string; iconUrl: string; cost: number }[];
}

export interface DraftSuggestion {
  championId: string;
  championName: string;
  score: number;
  reason: string;
  iconUrl: string;
}

export interface StateBalance {
  tempo: Tempo;
  winCondition: string;
  priority: string;
  recoveryPlan?: string;
}

export interface CoachTip {
  id: string;
  message: string;
  severity: "info" | "warn" | "crit";
  phase: Phase;
  prio?: number;
}

export interface ObjectiveCall {
  kind: "dragon" | "baron" | "herald" | "elder";
  secondsLeft: number; // 0 = alive now
  text: string; // action + reason, translated
  severity: "info" | "warn" | "crit";
}
