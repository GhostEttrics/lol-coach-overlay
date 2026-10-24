import { useStore } from "@/store";
import { objectiveState, fmtTime, SPAWN } from "@/engine/objectives";
import { t } from "@/i18n";
import type { GameData } from "@/hooks/useGameData";
import clsx from "clsx";

export function TabTimers({ data }: { data: GameData }) {
  const live = useStore((s) => s.live);
  const patch = useStore((s) => s.patch);
  const lang = useStore((s) => s.settings.lang);
  if (!live || !patch) return <div className="h-64 flex items-center justify-center text-[13px] text-white/35">{t(lang, "waitingLive")}</div>;

  const st = objectiveState(live, patch);
  const rows = [
    { icon: st.soulTeam ? "🐲" : "🐉", label: st.soulTeam ? t(lang, "obj.name.elder") : t(lang, "obj.name.dragon"), s: st.dragonIn },
    { icon: "👁", label: t(lang, "obj.name.baron"), s: st.now >= SPAWN.baronFirst - 90 ? st.baronIn : null },
    { icon: "💀", label: t(lang, "obj.name.herald"), s: st.heraldIn },
  ].filter((r) => r.s !== null) as { icon: string; label: string; s: number }[];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-white/80">Objetivos</span>
          <span className="text-[12px] text-white/50">🐉 {st.myDragons}x{st.enemyDragons}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const urgent = r.s < 15;
            return (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-[18px]">{r.icon}</span>
                <span className="text-[13px] text-white/70 w-28">{r.label}</span>
                <span className={clsx("font-mono text-[15px]", urgent ? "text-warn animate-pulse-soft" : r.s <= 0 ? "text-ok" : "text-white")}>
                  {r.s <= 0 ? "UP" : fmtTime(r.s)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-5">
        <div className="text-[13px] font-semibold text-white/80 mb-3">{t(lang, "nextObjective")}</div>
        {data.objective ? (
          <div className={clsx("rounded-lg px-4 py-3 text-[14px] leading-snug ring-1", data.objective.severity === "crit" ? "bg-danger/10 text-danger ring-danger/25" : data.objective.severity === "warn" ? "bg-warn/10 text-warn ring-warn/25" : "bg-white/[0.03] text-white/85 ring-white/10")}>
            {data.objective.text}
          </div>
        ) : (
          <div className="text-[13px] text-white/40">{t(lang, "noObjectiveSoon")}</div>
        )}
      </div>
    </div>
  );
}
