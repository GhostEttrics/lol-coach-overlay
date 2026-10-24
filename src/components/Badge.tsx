// Team gold advantage badge: +12k green, small swing yellow, -15k red.
// Gold is estimated (Live Client does not expose enemy gold): item value +
// kills/assists/CS, identical for both teams so the difference is fair.

import clsx from "clsx";
import { tempoOf } from "@/engine/stateBalance";
import type { LiveSnapshot } from "@/types";

function fmtK(n: number): string {
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1).replace(".", ",")}k`;
  return `${sign}${Math.round(abs)}`;
}

export function AdvantageBadge({ live, diff: diffProp }: { live?: LiveSnapshot; diff?: number }) {
  const { tempo, diff } = live
    ? tempoOf(live)
    : {
        diff: diffProp ?? 0,
        tempo: (diffProp ?? 0) > 1500 ? "ahead" : (diffProp ?? 0) < -1500 ? "behind" : "even",
      } as const;
  return (
    <span
      key={tempo}
      className={clsx(
        "badge-pop px-1.5 py-px rounded-full text-[10px] font-bold tabular-nums",
        tempo === "ahead" && "bg-ok/15 text-ok ring-1 ring-ok/30",
        tempo === "even" && "bg-warn/15 text-warn ring-1 ring-warn/30",
        tempo === "behind" && "bg-danger/15 text-danger ring-1 ring-danger/30"
      )}
      title="Vantagem de ouro estimada do time"
    >
      {fmtK(diff)}
    </span>
  );
}
