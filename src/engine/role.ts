// Player identity and role resolution.
//
// In-game the source of truth is Live Client `allPlayers[me].position`.
// Riot leaves it EMPTY in Co-op vs AI, ARAM and some customs, which is what
// happened in the test game (Caitlyn vs bots): the old code never read it and
// every text defaulted to mid. Resolution order now:
//
//   1. manual override (role chip in the overlay header)
//   2. Live Client position, when Riot fills it
//   3. role from this game's champion select, when the client assigned one
//   4. inference: Smite -> JUNGLE, else the champion's primary Data Dragon tag
//
// The overlay always shows the resolved role and its source, so a wrong guess
// is visible and fixable with one click.

import type {
  Champion,
  LiveSnapshot,
  PatchData,
  PlayerShort,
  Role,
  RoleSource,
} from "@/types";

export function normRole(pos: string | null | undefined): Role | null {
  const p = (pos ?? "").trim().toUpperCase();
  switch (p) {
    case "TOP":
      return "TOP";
    case "JUNGLE":
      return "JUNGLE";
    case "MIDDLE":
    case "MID":
      return "MIDDLE";
    case "BOTTOM":
    case "BOT":
    case "ADC":
      return "BOTTOM";
    case "UTILITY":
    case "SUPPORT":
      return "UTILITY";
    default:
      return null;
  }
}

function ids(x: { summonerName?: string; riotId?: string; riotIdGameName?: string }): string[] {
  const out: string[] = [];
  for (const v of [x.riotId, x.summonerName, x.riotIdGameName]) {
    if (!v) continue;
    const s = v.trim().toLowerCase();
    out.push(s);
    const hash = s.indexOf("#");
    if (hash > 0) out.push(s.slice(0, hash));
  }
  return out;
}

// Riot ID migration made summonerName formats inconsistent between
// activePlayer and allPlayers. Match on any shared identifier.
export function samePlayer(
  a: { summonerName?: string; riotId?: string; riotIdGameName?: string },
  b: { summonerName?: string; riotId?: string; riotIdGameName?: string }
): boolean {
  const A = ids(a);
  const B = new Set(ids(b));
  return A.some((x) => B.has(x));
}

export function nameMatches(name: unknown, p: PlayerShort): boolean {
  if (typeof name !== "string" || !name) return false;
  return samePlayer({ summonerName: name }, p);
}

export function findMe(live: LiveSnapshot): PlayerShort | null {
  return live.allPlayers.find((p) => samePlayer(live.activePlayer, p)) ?? null;
}

export function findPlayerByName(live: LiveSnapshot, name: unknown): PlayerShort | null {
  return live.allPlayers.find((p) => nameMatches(name, p)) ?? null;
}

export function champIdOf(p: PlayerShort): string {
  // "game_character_displayname_MonkeyKing" -> "MonkeyKing"
  const raw = (p.rawChampionName || "").split("_").pop() ?? "";
  return raw || p.championName.replace(/[\s'.]/g, "");
}

export function champOf(p: PlayerShort, patch: PatchData | null): Champion | null {
  if (!patch) return null;
  return patch.champion.data[champIdOf(p)] ?? null;
}

export function hasSmite(p: PlayerShort): boolean {
  const spells = [p.summonerSpells?.summonerSpellOne, p.summonerSpells?.summonerSpellTwo];
  return spells.some((s) => {
    const raw = `${s?.rawDisplayName ?? ""} ${s?.displayName ?? ""}`.toLowerCase();
    return raw.includes("smite") || raw.includes("golpear");
  });
}

export function inferRoleFromChampion(c: Champion | null): Role {
  const tags = c?.tags ?? [];
  const primary = tags[0];
  if (primary === "Marksman") return "BOTTOM";
  if (primary === "Support") return "UTILITY";
  if ((primary === "Tank" || primary === "Mage") && tags.includes("Support")) return "UTILITY";
  if (primary === "Mage" || primary === "Assassin") return "MIDDLE";
  return "TOP";
}

export function roleOfPlayer(p: PlayerShort, patch: PatchData | null): Role {
  const pos = normRole(p.position);
  if (pos) return pos;
  if (hasSmite(p)) return "JUNGLE";
  return inferRoleFromChampion(champOf(p, patch));
}

export function resolveMyRole(
  live: LiveSnapshot,
  patch: PatchData | null,
  draftRole: Role | null,
  override: Role | null
): { role: Role; source: RoleSource } {
  if (override) return { role: override, source: "override" };
  const me = findMe(live);
  const pos = normRole(me?.position);
  if (pos) return { role: pos, source: "game" };
  if (draftRole) return { role: draftRole, source: "draft" };
  if (me && hasSmite(me)) return { role: "JUNGLE", source: "inferred" };
  return { role: inferRoleFromChampion(me ? champOf(me, patch) : null), source: "inferred" };
}

export function teams(live: LiveSnapshot): { me: PlayerShort | null; allies: PlayerShort[]; enemies: PlayerShort[] } {
  const me = findMe(live);
  if (!me) return { me: null, allies: [], enemies: [] };
  return {
    me,
    allies: live.allPlayers.filter((p) => p.team === me.team),
    enemies: live.allPlayers.filter((p) => p.team !== me.team),
  };
}

// Enemy playing the same role. With empty positions, every enemy is inferred
// the same way; if two collide we take the first one.
export function laneOpponent(
  live: LiveSnapshot,
  patch: PatchData | null,
  myRole: Role
): PlayerShort | null {
  const { enemies } = teams(live);
  return enemies.find((e) => roleOfPlayer(e, patch) === myRole) ?? null;
}

export function enemyJungler(live: LiveSnapshot, patch: PatchData | null): PlayerShort | null {
  const { enemies } = teams(live);
  return (
    enemies.find((e) => normRole(e.position) === "JUNGLE") ??
    enemies.find((e) => hasSmite(e)) ??
    null
  );
}
