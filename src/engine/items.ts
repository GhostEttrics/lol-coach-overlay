// Item classification and shop math, driven only by Data Dragon fields.
//
// Lessons from patch 16.21 data (the real cause of the bad suggestions):
//   - Tier 2 boots now have `into` (e.g. Mercury's Treads 3111 -> 3173), so
//     "no into" no longer means "finished item".
//   - Tier 3 boots (3168, 3170-3175) are free upgrades (`gold.base` 0) gated
//     by the game; "Esmagadores Acorrentados" (3173) is one of them. It is NOT
//     a Smite item; the Smite item found in the shop search was
//     "Broto de Esmagamusgo" (1103), a jungle pet.
//   - `depth` is unreliable (Infinity Edge 3031 is depth 2).
//   - IDs longer than 4 digits (323070, 667666...) are other-mode variants.
//
// So everything below derives tiers from the recipe graph instead of hardcoded
// ID lists. No more hand-typed boots set (that set wrongly contained 3153,
// Blade of the Ruined King, which is why it was suggested with a boots reason).

import type { InventoryItem, Item, PatchData } from "@/types";

const SR = "11";

export function srItem(patch: PatchData, id: string): Item | null {
  if (!id || id.length > 4) return null;
  const it = patch.item.data[id];
  if (!it) return null;
  if (!it.gold?.purchasable) return null;
  if (!it.maps?.[SR]) return null;
  if (it.inStore === false) return null;
  if (it.hideFromAll) return null;
  if (it.requiredChampion || it.requiredAlly || it.specialRecipe) return null;
  return it;
}

export function isBoots(it: Item | null | undefined): boolean {
  return !!it?.tags?.includes("Boots");
}

// 1 = basic Boots, 2 = Berserker's / Mercury's / ..., 3 = game-gated upgrade.
export function bootsTier(patch: PatchData, id: string): 0 | 1 | 2 | 3 {
  const it = patch.item.data[id];
  if (!isBoots(it)) return 0;
  const from = it!.from ?? [];
  if (from.length === 0) return 1;
  const fromUpgradedBoots = from.some((f) => {
    const fi = patch.item.data[f];
    return isBoots(fi) && (fi!.from?.length ?? 0) > 0;
  });
  return fromUpgradedBoots ? 3 : 2;
}

export function isJungleItem(it: Item | null | undefined): boolean {
  if (!it) return false;
  const tags = it.tags ?? [];
  return tags.includes("Jungle") && !tags.includes("Consumable") && !tags.includes("Lane");
}

function hasSrUpgrade(patch: PatchData, it: Item): boolean {
  return (it.into ?? []).some((id) => srItem(patch, id) !== null);
}

export function isLegendary(patch: PatchData, id: string): boolean {
  const it = srItem(patch, id);
  if (!it) return false;
  if (isBoots(it)) return false;
  if (isJungleItem(it)) return false;
  const tags = it.tags ?? [];
  if (tags.includes("Consumable") || tags.includes("Trinket")) return false;
  if ((it.gold.total ?? 0) < 2000) return false;
  if (hasSrUpgrade(patch, it)) return false;
  return true;
}

export function isT2Boots(patch: PatchData, id: string): boolean {
  return srItem(patch, id) !== null && bootsTier(patch, id) === 2;
}

export function isStarter(patch: PatchData, id: string): boolean {
  const it = srItem(patch, id);
  if (!it) return false;
  return (it.gold.total ?? 0) <= 500 && (it.from?.length ?? 0) === 0 && !isBoots(it);
}

export function itemIcon(patch: PatchData, id: string): string {
  const it = patch.item.data[id];
  return `${patch.cdn}/img/item/${it?.image?.full ?? `${id}.png`}`;
}

// Inventory as a multiset of item ids (consumables count once per slot).
export function inventoryPool(inv: InventoryItem[]): Map<string, number> {
  const pool = new Map<string, number>();
  for (const i of inv) {
    const k = String(i.itemID);
    pool.set(k, (pool.get(k) ?? 0) + 1);
  }
  return pool;
}

// Exactly how the shop prices an item: owned recipe parts are consumed
// (each owned copy once), missing parts are bought at their own effective
// cost, plus the item's combine cost (`gold.base`).
// Mutates `pool` (consumes owned parts). `top` = the item itself is not
// taken from inventory.
export function costWithPool(
  patch: PatchData,
  id: string,
  pool: Map<string, number>,
  top = true
): number {
  if (!top && (pool.get(id) ?? 0) > 0) {
    pool.set(id, pool.get(id)! - 1);
    return 0;
  }
  const it = patch.item.data[id];
  if (!it) return 0;
  const from = it.from ?? [];
  if (from.length === 0) return it.gold.total ?? 0;
  let c = it.gold.base ?? 0;
  for (const f of from) c += costWithPool(patch, f, pool, false);
  return c;
}

export function effectiveCost(patch: PatchData, id: string, inv: InventoryItem[]): number {
  return costWithPool(patch, id, inventoryPool(inv), true);
}

// What to buy right now on the way to `targetId` with `gold`.
// Greedy: most expensive missing part first; if a part is too expensive,
// go one level down into its own recipe. Mirrors what a good player does
// on a short recall.
export function buyNowPlan(
  patch: PatchData,
  targetId: string,
  inv: InventoryItem[],
  gold: number
): { id: string; cost: number }[] {
  let pool = inventoryPool(inv);
  let budget = gold;
  const plan: { id: string; cost: number }[] = [];

  const tryBuy = (id: string): boolean => {
    const clone = new Map(pool);
    const c = costWithPool(patch, id, clone, true);
    if (c > 0 && c <= budget) {
      budget -= c;
      pool = clone;
      plan.push({ id, cost: c });
      return true;
    }
    return false;
  };

  const visit = (id: string, depth: number) => {
    if (depth > 3) return;
    const it = patch.item.data[id];
    if (!it) return;
    const missing: string[] = [];
    for (const f of it.from ?? []) {
      const have = pool.get(f) ?? 0;
      if (have > 0) pool.set(f, have - 1);
      else missing.push(f);
    }
    missing.sort(
      (a, b) => (patch.item.data[b]?.gold.total ?? 0) - (patch.item.data[a]?.gold.total ?? 0)
    );
    for (const f of missing) {
      if (!tryBuy(f)) visit(f, depth + 1);
    }
  };

  visit(targetId, 0);
  return plan.slice(0, 4);
}
