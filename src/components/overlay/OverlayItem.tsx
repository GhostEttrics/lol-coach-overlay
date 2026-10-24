// Compact item card for the overlay: 48px icon, name, price, one-line reason,
// gold bar, two pills. No scroll.

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
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#1a2232"/><text x="24" y="27" font-family="Inter" font-size="9" fill="#67e8f9" text-anchor="middle">#${id}</text></svg>`
    )
  );
}

export function OverlayItem({ data }: { data: GameData }) {
  const live = useStore((s) => s.live);
  const lang = useStore((s) => s.settings.lang);
  const autoBuy = useStore((s) => s.settings.automation.auto_buy);
  const silent = useStore((s) => s.silent);
  const rec = data.rec;

  if (!rec) return <div className="px-3 py-3 text-[11px] text-white/45">{t(lang, "waitingLive")}</div>;

  const current = live?.activePlayer.currentGold ?? 0;
  const inBase = looksInBase(live);

  async function fireBuy() {
    if (!rec!.canAffordNow || !inBase || !autoBuy || silent) return;
    await invoke("request_auto_buy", { itemId: rec!.itemId }).catch(() => {});
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-1.5" key={rec.itemId}>
      <div className="flex gap-2.5 items-start fade-slide-in">
        <button
          onClick={fireBuy}
          className={clsx("no-drag relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden ring-1", rec.canAffordNow ? "ring-ok/70 pulse-ring" : "ring-accent/30")}
          title={autoBuy ? t(lang, "autoBuyOn") : t(lang, "autoBuyOff")}
        >
          <img
            src={rec.iconUrl}
            alt={rec.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = placeholder(rec.itemId);
            }}
          />
          <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_12px_rgba(0,212,255,0.25)] pointer-events-none" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-white truncate">{rec.name}</span>
            <span className="ml-auto text-[11px] text-white/55 font-mono flex-shrink-0">{fmtGold(lang, rec.gold)}g</span>
          </div>
          <div className="text-[10px] text-white/50 truncate">
            <span className="text-white/35">{t(lang, "why")} </span>
            {rec.reason}
          </div>
        </div>
      </div>

      <GoldBar current={current} total={rec.gold} effectiveCost={rec.effectiveCost} lang={lang} />

      <div className="flex items-center gap-1.5">
        <Pill tone={rec.canAffordNow ? "ok" : "muted"}>
          {rec.canAffordNow ? t(lang, "affordNow") : t(lang, "needGold", { g: fmtGold(lang, rec.goldRemaining) })}
        </Pill>
        {inBase && <Pill tone="accent">{t(lang, "inBase")}</Pill>}
        {autoBuy && <Pill tone="danger">{t(lang, "autoBuyOn")}</Pill>}
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "accent" | "ok" | "danger" | "muted"; children: React.ReactNode }) {
  const map = {
    accent: "bg-accent/10 text-accent ring-accent/30",
    ok: "bg-ok/10 text-ok ring-ok/30",
    danger: "bg-danger/10 text-danger ring-danger/30",
    muted: "bg-white/[0.04] text-white/60 ring-white/10",
  } as const;
  return <span className={clsx("text-[10px] px-2 py-0.5 rounded-full ring-1 font-medium whitespace-nowrap", map[tone])}>{children}</span>;
}
