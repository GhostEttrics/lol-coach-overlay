// Progress toward the target item, counting what is already invested in its
// recipe parts. have = (total - effectiveCost) + current gold.
//   >= 100% green, >= 80% yellow, below red.

import clsx from "clsx";
import { fmtGold, t } from "@/i18n";
import type { Lang } from "@/types";

export function GoldBar({
  current,
  total,
  effectiveCost,
  lang,
}: {
  current: number;
  total: number;
  effectiveCost: number;
  lang: Lang;
}) {
  const safeTotal = Math.max(1, total);
  const invested = Math.max(0, total - effectiveCost);
  const have = invested + current;
  const ratio = Math.min(1, Math.max(0, have / safeTotal));
  const bg = ratio >= 1 ? "bg-ok" : ratio >= 0.8 ? "bg-warn" : "bg-danger";

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-[10px] mb-0.5">
        <span className={clsx("font-mono tabular-nums", ratio >= 1 ? "text-ok" : "text-white/55")}>
          {fmtGold(lang, Math.min(have, total))} / {fmtGold(lang, total)}g
        </span>
        {invested > 0 ? (
          <span className="text-white/40">{t(lang, "ownedParts", { g: fmtGold(lang, invested) })}</span>
        ) : (
          <span className="text-white/35 font-mono">{Math.round(ratio * 100)}%</span>
        )}
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-300", bg)}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
