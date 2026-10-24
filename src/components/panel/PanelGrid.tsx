// Dashboard grid of rich cards. Content is real engine output; cards show
// a placeholder when not in game.
import clsx from "clsx";
import { useStore } from "@/store";
import { Card } from "./Card";
import { fmtGold, t } from "@/i18n";
import type { GameData } from "@/hooks/useGameData";

export function PanelGrid({ data }: { data: GameData }) {
  const lang = useStore((s) => s.settings.lang);
  const inGame = useStore((s) => s.inGame);
  const autoBuy = useStore((s) => s.settings.automation.auto_buy);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Próximo Item */}
      <Card
        id="item"
        title="Próximo Item"
        description="Roda de itens recomendados para o seu campeão."
      >
        {data.rec ? (
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-cyan-400/30">
              <img
                src={data.itemIcon ?? data.rec.iconUrl}
                alt={data.rec.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">
                {data.rec.name}
              </div>
              <div className="text-[11px] text-amber-300/90">
                {fmtGold(lang, data.rec.gold)}g · {stageLabel(data, lang)}
              </div>
              <div className="mt-1 text-[10.5px] leading-snug text-white/50">
                {data.rec.reason}
              </div>
            </div>
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Dicas do Coach */}
      <Card
        id="tips"
        title="Dicas do Coach"
        description="Dicas em tempo real para melhorar sua tomada de decisão."
      >
        {data.tips.length ? (
          <ul className="flex flex-col gap-1.5">
            {data.tips.slice(0, 3).map((tip) => (
              <li
                key={tip.id}
                className={clsx(
                  "rounded-lg px-2.5 py-1.5 text-[11px] leading-snug ring-1",
                  sev(tip.severity)
                )}
              >
                {tip.message}
              </li>
            ))}
          </ul>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Objetivos */}
      <Card
        id="objectives"
        title="Objetivos"
        description="Timers de dragão, barão e objetivos globais."
      >
        {inGame ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60">🐉 Dragão</span>
              <span className="font-semibold tabular-nums text-white">
                {data.dragonScore.mine}x{data.dragonScore.enemy}
              </span>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/70 ring-1 ring-white/10">
              {data.objective ? data.objective.text : t(lang, "noObjectiveSoon")}
            </div>
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Vantagem de Ouro */}
      <Card
        id="gold"
        title="Vantagem de Ouro"
        description="Visualize a diferença de ouro entre sua equipe e a inimiga."
      >
        {inGame ? <GoldDiff diff={data.goldDiff} lang={lang} /> : <Empty lang={lang} />}
      </Card>

      {/* Condição de Vitória */}
      <Card
        id="wincond"
        title="Condição de Vitória"
        description="Saiba o que precisa fazer para garantir a vitória."
      >
        {data.balance ? (
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="text-white/80">{data.balance.winCondition}</div>
            <div className="text-white/50">
              {t(lang, "priority")}: {data.balance.priority}
            </div>
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Ameaças */}
      <Card
        id="threats"
        title="Ameaças"
        description="Veja os campeões inimigos e seus níveis de ameaça."
      >
        {data.threats.length ? (
          <div className="flex flex-col gap-2">
            {data.threats.map((th, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-16 truncate text-[11px] text-white/70">
                  {th.name}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={clsx(
                      "h-full rounded-full",
                      th.weight > 0.6
                        ? "bg-danger"
                        : th.weight > 0.4
                          ? "bg-warn"
                          : "bg-accent"
                    )}
                    style={{ width: `${th.weight * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Meu Laner */}
      <Card
        id="lane"
        title="Meu Laner"
        description="Informações do confronto na rota e dicas de overlay."
      >
        {inGame && data.lane?.opp ? (
          <div className="flex items-center justify-between text-[11px]">
            <span
              className={clsx(
                "font-semibold",
                data.lane.csDiff >= 0 ? "text-ok" : "text-danger"
              )}
            >
              {data.lane.csDiff >= 0 ? "+" : ""}
              {data.lane.csDiff} CS
            </span>
            <span className="text-white/50">
              {t(lang, "lvl")} {data.lane.me.level}·{data.lane.opp.level}
            </span>
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Visão & Rota */}
      <Card
        id="vision"
        title="Visão & Rota"
        description="Sugestões de rota e colocação de wards."
      >
        {data.balance ? (
          <div className="text-[11px] text-white/70">
            {data.objective?.text ?? data.balance.priority}
          </div>
        ) : (
          <Empty lang={lang} />
        )}
      </Card>

      {/* Auto-Compra */}
      <Card
        id="autobuy"
        title="Auto-Compra"
        description="Compre automaticamente os itens recomendados."
      >
        <div className="flex flex-col gap-1 text-[11px]">
          <span className={autoBuy ? "text-ok" : "text-white/50"}>
            {autoBuy ? t(lang, "autoBuyOn") : t(lang, "autoBuyOff")}
          </span>
          {data.rec && (
            <span className="text-white/50">
              {t(lang, "suggested")}: {data.rec.name}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}

function stageLabel(data: GameData, lang: "pt-BR" | "en"): string {
  const r = data.rec!;
  return r.stage === "core"
    ? t(lang, "stage.core", { n: r.step })
    : r.stage === "boots"
      ? t(lang, "stage.boots")
      : r.stage === "start"
        ? t(lang, "stage.start")
        : t(lang, "stage.situational");
}

function GoldDiff({ diff, lang }: { diff: number; lang: "pt-BR" | "en" }) {
  const ahead = diff >= 0;
  const pct = Math.min(1, Math.abs(diff) / 10000);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-white/40">0</span>
        <span
          className={clsx(
            "font-bold tabular-nums",
            ahead ? "text-ok" : "text-danger"
          )}
        >
          {ahead ? "+" : "-"}
          {fmtGold(lang, Math.abs(diff))}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={clsx(
            "bar-grow h-full rounded-full",
            ahead ? "bg-ok" : "bg-danger"
          )}
          style={{ width: `${Math.max(8, pct * 100)}%` }}
        />
      </div>
    </div>
  );
}

function sev(s: "info" | "warn" | "crit"): string {
  return s === "crit"
    ? "bg-danger/10 text-danger ring-danger/25"
    : s === "warn"
      ? "bg-warn/10 text-warn ring-warn/25"
      : "bg-white/[0.03] text-white/80 ring-white/10";
}

function Empty({ lang, hint }: { lang: "pt-BR" | "en"; hint?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.02] px-2.5 py-3 text-center text-[11px] text-white/35 ring-1 ring-white/5">
      {hint ?? t(lang, "waitingLive")}
    </div>
  );
}
