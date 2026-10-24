import clsx from "clsx";
import { useStore } from "@/store";
import { t } from "@/i18n";
import type { GameData } from "@/hooks/useGameData";

export function TabCoach({ data }: { data: GameData }) {
  const lang = useStore((s) => s.settings.lang);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-5">
        <div className="text-[13px] font-semibold text-white/80 mb-3">{t(lang, "tipsTitle")}</div>
        {data.tips.length ? (
          <ul className="flex flex-col gap-2">
            {data.tips.map((tip) => (
              <li key={tip.id} className={clsx("rounded-lg px-3 py-2.5 text-[13px] leading-snug ring-1", sev(tip.severity))}>
                {tip.message}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-[13px] text-white/35">{t(lang, "waitingLive")}</div>
        )}
      </div>
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-5">
        <div className="text-[13px] font-semibold text-white/80 mb-3">{t(lang, "winCondition")}</div>
        {data.balance ? (
          <div className="flex flex-col gap-3">
            <div className="text-[14px] text-white/90 leading-snug">{data.balance.winCondition}</div>
            <div className="text-[12px] text-white/55">
              <span className="text-white/35">{t(lang, "priority")}: </span>
              {data.balance.priority}
            </div>
            {data.balance.recoveryPlan && (
              <div className="text-[12px] text-warn/80">
                <span className="text-warn/55">{t(lang, "recovery")}: </span>
                {data.balance.recoveryPlan}
              </div>
            )}
          </div>
        ) : (
          <div className="text-[13px] text-white/35">{t(lang, "waitingLive")}</div>
        )}
      </div>
    </div>
  );
}

function sev(s: "info" | "warn" | "crit"): string {
  return s === "crit" ? "bg-danger/10 text-danger ring-danger/25" : s === "warn" ? "bg-warn/10 text-warn ring-warn/25" : "bg-white/[0.03] text-white/85 ring-white/10";
}
