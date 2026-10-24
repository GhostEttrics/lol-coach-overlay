// Compact in-game item card: 48px icon with glow, name, price, one-line
// reason, gold bar, two pills. No scroll.
import type { ReactNode } from "react";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { GoldBar } from "@/components/GoldBar";
import { fmtGold, t } from "@/i18n";
import type { GameData } from "@/hooks/useGameData";
import type { LiveSnapshot } from "@/types";

function looksInBase(live: LiveSnapshot | null): boolean {
  const s = live?.activePlayer?.championStats;
  if (!s) return false;
  const hp = s.currentHealth >= s.maxHealth * 0.98;
  const res = s.resourceMax === 0 || s.resourceValue >= s.resourceMax * 0.98;
  return hp && res;
}

function placeholder(id: number): string {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect width='48' height='48' rx='8' fill='#1a2230'/><text x='24' y='30' font-size='12' fill='#5a6b82' text-anchor='middle'>#${id}</text></svg>`
    )
  );
}

export function OverlayItem({ data }: { data: GameData }) {
  const live = useStore((s) => s.live);
  const lang = useStore((s) => s.settings.lang);
  const autoBuy = useStore((s) => s.settings.automation.auto_buy);
  const silent = useStore((s) => s.silent);
  const rec = data.rec;

  if (!rec)
    return (
      <div className="px-1 py-2 text-[11px] text-white/50">
        {t(lang, "waitingLive")}
      </div>
    );

  const current = live?.activePlayer.currentGold ?? 0;
  const inBase = looksInBase(live);

  async function fireBuy() {
    if (!rec!.canAffordNow || !inBase || !autoBuy || silent) return;
    await invoke("request_auto_buy", { itemId: rec!.itemId }).catch(() => {});
  }

  return (
    <div className="fade-slide-in flex flex-col gap-2.5">
      {/* Item row */}
      <div className="flex items-start gap-3">
        <div
          className={clsx(
            "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-cyan-400/40",
            rec.canAffordNow && "pulse-ring glow-green"
          )}
        >
          <img
            src={data.itemIcon ?? rec.iconUrl ?? placeholder(rec.itemId)}
            alt={rec.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = placeholder(rec.itemId);
            }}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight text-white text-glow">
            {rec.name}
          </div>
          <div className="text-[11px] font-medium text-amber-300/90">
            {fmtGold(lang, rec.gold)}g
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="text-[10.5px] leading-snug text-white/55">
        <span className="text-white/40">{t(lang, "why")} </span>
        {rec.reason}
      </div>

      {/* Gold bar */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[10px] text-white/50">
          <span>
            {rec.canAffordNow
              ? t(lang, "affordNow")
              : t(lang, "needGold", { g: fmtGold(lang, rec.goldRemaining) })}
          </span>
          <span className="tabular-nums">
            {fmtGold(lang, current)} / {fmtGold(lang, rec.gold)}
          </span>
        </div>
        <GoldBar current={current} needed={rec.gold} total={rec.gold} effectiveCost={rec.effectiveCost} lang={lang} />
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-1.5">
        {rec.canAffordNow && (
          <Pill tone="accent" onClick={fireBuy}>
            {t(lang, "affordNow")}
          </Pill>
        )}
        {inBase && <Pill tone="ok">{t(lang, "inBase")}</Pill>}
        {autoBuy && <Pill tone="muted">{t(lang, "autoBuyOn")}</Pill>}
      </div>
    </div>
  );
}

function Pill({
  tone,
  children,
  onClick,
}: {
  tone: "accent" | "ok" | "danger" | "muted";
  children: ReactNode;
  onClick?: () => void;
}) {
  const map = {
    accent: "bg-accent/10 text-accent ring-accent/30 hover:bg-accent/20",
    ok: "bg-ok/10 text-ok ring-ok/30",
    danger: "bg-danger/10 text-danger ring-danger/30",
    muted: "bg-white/[0.04] text-white/60 ring-white/10",
  } as const;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "no-drag rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition-colors",
        map[tone]
      )}
    >
      {children}
    </button>
  );
}
