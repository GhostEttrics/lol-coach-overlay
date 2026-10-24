// The dashboard grid of cards (mockup #1). Content is real engine output; a
// few cards show a placeholder when not in game.

import clsx from "clsx";
import { useStore } from "@/store";
import { Card } from "./Card";
import { GoldBar } from "@/components/GoldBar";
import { fmtGold, t, tx } from "@/i18n";
import type { GameData } from "@/hooks/useGameData";

export function PanelGrid({ data }: { data: GameData }) {
  const lang = useStore((s) => s.settings.lang);
  const inGame = useStore((s) => s.inGame);
  const autoBuy = useStore((s) => s.settings.automation.auto_buy);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <Card id="item" title={t(lang, "cardItem.title")} description={t(lang, "cardItem.desc")}>
        {data.rec ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <img src={data.rec.iconUrl} alt="" className="w-12 h-12 rounded-xl ring-1 ring-white/10" />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold truncate">{data.rec.name}</div>
                <div className="text-[12px] text-white/50">{fmtGold(lang, data.rec.gold)}g · {stageLabel(data, lang)}</div>
              </div>
            </div>
            <GoldBar current={data.me ? (useStore.getState().live?.activePlayer.currentGold ?? 0) : 0} total={data.rec.gold} effectiveCost={data.rec.effectiveCost} lang={lang} />
            <div className="text-[11px] text-white/50">{data.rec.reason}</div>
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      <Card id="coach" title={t(lang, "cardCoach.title")} description={t(lang, "cardCoach.desc")}>
        {data.tips.length ? (
          <ul className="flex flex-col gap-2">
            {data.tips.slice(0, 3).map((tip) => (
              <li key={tip.id} className={clsx("rounded-lg px-3 py-2 text-[12px] leading-snug ring-1", sev(tip.severity))}>
                {tip.message}
              </li>
            ))}
          </ul>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      <Card id="objectives" title={t(lang, "cardObj.title")} description={t(lang, "cardObj.desc")}>
        {inGame ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-4 text-[13px]">
              <span className="text-white/60">🐉 {data.dragonScore.mine}x{data.dragonScore.enemy}</span>
            </div>
            {data.objective ? (
              <div className={clsx("rounded-lg px-3 py-2 text-[12px] ring-1", sev(data.objective.severity))}>{data.objective.text}</div>
            ) : (
              <div className="text-[12px] text-white/40">{t(lang, "noObjectiveSoon")}</div>
            )}
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      <Card id="gold" title={t(lang, "cardGold.title")} description={t(lang, "cardGold.desc")}>
        {inGame ? <GoldDiff diff={data.tempoDiff} lang={lang} /> : <Empty lang={lang} />}
      </Card>

      <Card id="winCondition" title={t(lang, "cardWin.title")} description={t(lang, "cardWin.desc")}>
        {data.balance ? (
          <div className="flex flex-col gap-1.5">
            <div className="text-[13px] text-white/90 leading-snug">{data.balance.winCondition}</div>
            <div className="text-[11px] text-white/50">
              <span className="text-white/35">{t(lang, "priority")}: </span>
              {data.balance.priority}
            </div>
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      <Card id="threats" title={t(lang, "cardThreats.title")} description={t(lang, "cardThreats.desc")}>
        {data.threats.length ? (
          <div className="flex items-end gap-3">
            {data.threats.map((th) => (
              <div key={th.name} className="flex flex-col items-center gap-1 w-12">
                <img src={th.icon} alt="" className="w-9 h-9 rounded-full ring-1 ring-white/10" title={th.name} />
                <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className={clsx("h-full rounded-full", th.weight > 0.6 ? "bg-danger" : th.weight > 0.4 ? "bg-warn" : "bg-accent")} style={{ width: `${th.weight * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      <Card id="laneMatchup" title={t(lang, "cardLane.title")} description={t(lang, "cardLane.desc")}>
        {inGame && data.lane?.opp ? (
          <div className="flex items-center justify-between gap-2">
            <ChampFace icon={data.lane.meIcon} name={data.lane.meName} tint="accent" />
            <div className="flex flex-col items-center text-[10px] text-white/50">
              <span className={clsx(data.lane.csDiff >= 0 ? "text-ok" : "text-danger")}>{data.lane.csDiff >= 0 ? "+" : ""}{data.lane.csDiff} CS</span>
              <span className="text-white/30 text-[13px] font-bold">vs</span>
              <span className="text-white/40">{t(lang, "lvl")} {data.lane.me.level}·{data.lane.opp.level}</span>
            </div>
            <ChampFace icon={data.lane.oppIcon} name={data.lane.oppName} tint="danger" />
          </div>
        ) : (
          <Empty lang={lang} hint={inGame ? t(lang, "noLaneOpp") : undefined} />
        )}
      </Card>

      <Card id="vision" title={t(lang, "cardVision.title")} description={t(lang, "cardVision.desc")}>
        {data.balance ? (
          <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/5 px-3 py-2.5 text-[12px] text-white/75 leading-snug">
            {data.objective?.text ?? data.balance.priority}
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      <Card id="autoBuy" title={t(lang, "cardAuto.title")} description={t(lang, "cardAuto.desc")}>
        <div className="flex items-center gap-2">
          <span className={clsx("text-[12px] px-2.5 py-1 rounded-full ring-1", autoBuy ? "bg-danger/15 text-danger ring-danger/30" : "bg-white/[0.04] text-white/50 ring-white/10")}>
            {autoBuy ? t(lang, "autoBuyOn") : t(lang, "autoBuyOff")}
          </span>
          {data.rec && <span className="text-[11px] text-white/45 truncate">{t(lang, "suggested")}: {data.rec.name}</span>}
        </div>
      </Card>
    </div>
  );
}

function stageLabel(data: GameData, lang: "pt-BR" | "en"): string {
  const r = data.rec!;
  return r.stage === "core" ? t(lang, "stage.core", { n: r.step }) : r.stage === "boots" ? t(lang, "stage.boots") : r.stage === "start" ? t(lang, "stage.start") : t(lang, "stage.situational");
}

function GoldDiff({ diff, lang }: { diff: number; lang: "pt-BR" | "en" }) {
  const ahead = diff >= 0;
  const pct = Math.min(1, Math.abs(diff) / 10000);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-white/40">0</span>
        <span className={clsx("font-bold font-mono", ahead ? "text-ok" : "text-danger")}>{ahead ? "+" : "-"}{fmtGold(lang, Math.abs(diff))}</span>
      </div>
      <div className="relative h-3 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={clsx("absolute inset-y-0", ahead ? "left-1/2 bg-ok" : "right-1/2 bg-danger")} style={{ width: `${pct * 50}%` }} />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
      </div>
    </div>
  );
}

function ChampFace({ icon, name, tint }: { icon: string; name: string; tint: "accent" | "danger" }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <img src={icon} alt="" className={clsx("w-11 h-11 rounded-full ring-2", tint === "accent" ? "ring-accent/50" : "ring-danger/50")} />
      <span className="text-[11px] text-white/70 truncate max-w-[72px]">{name}</span>
    </div>
  );
}

function sev(s: "info" | "warn" | "crit"): string {
  return s === "crit" ? "bg-danger/10 text-danger ring-danger/25" : s === "warn" ? "bg-warn/10 text-warn ring-warn/25" : "bg-white/[0.03] text-white/80 ring-white/10";
}

function Empty({ lang, hint }: { lang: "pt-BR" | "en"; hint?: string }) {
  return <div className="h-full min-h-[64px] flex items-center justify-center text-[12px] text-white/30">{hint ?? t(lang, "waitingLive")}</div>;
}
