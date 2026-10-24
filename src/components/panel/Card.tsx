// Panel card with a rich colored thumbnail header (premium dashboard style).
import type { ReactNode } from "react";
import clsx from "clsx";
import { useStore, cardEnabled } from "@/store";
import { saveSettings } from "@/hooks/useBootstrap";

type Theme = { grad: string; icon: string; accent: string };

const THEMES: Record<string, Theme> = {
  item:       { grad: "from-amber-400/25 via-orange-500/15 to-transparent",   icon: "⚔️", accent: "#fbbf24" },
  tips:       { grad: "from-cyan-400/25 via-sky-500/15 to-transparent",       icon: "💡", accent: "#00d4ff" },
  objectives: { grad: "from-fuchsia-400/25 via-purple-500/15 to-transparent", icon: "🐉", accent: "#c084fc" },
  gold:       { grad: "from-emerald-400/25 via-green-500/15 to-transparent",  icon: "💰", accent: "#4ade80" },
  wincond:    { grad: "from-rose-400/25 via-red-500/15 to-transparent",       icon: "👑", accent: "#fb7185" },
  threats:    { grad: "from-red-400/25 via-rose-500/15 to-transparent",       icon: "🎯", accent: "#f87171" },
  lane:       { grad: "from-sky-400/25 via-indigo-500/15 to-transparent",     icon: "🛡️", accent: "#38bdf8" },
  vision:     { grad: "from-teal-400/25 via-cyan-500/15 to-transparent",      icon: "🗺️", accent: "#2dd4bf" },
  autobuy:    { grad: "from-lime-400/25 via-emerald-500/15 to-transparent",   icon: "🤖", accent: "#a3e635" },
};

const FALLBACK: Theme = { grad: "from-slate-500/25 to-transparent", icon: "▦", accent: "#94a3b8" };

export function Card({
  id,
  title,
  description,
  children,
  wide,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const settings = useStore((s) => s.settings);
  const enabled = cardEnabled(settings, id);
  const theme = THEMES[id] ?? FALLBACK;

  const toggle = () => {
    const cards = { ...(settings.panel_cards as Record<string, boolean>), [id]: !enabled };
    saveSettings({ ...settings, panel_cards: cards });
  };

  return (
    <div
      className={clsx(
        "card-surface card-hover flex flex-col overflow-hidden rounded-2xl",
        wide && "col-span-2"
      )}
    >
      {/* Thumbnail header */}
      <div
        className={clsx(
          "relative h-24 shrink-0 overflow-hidden bg-gradient-to-br",
          theme.grad
        )}
      >
        {/* subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />
        {/* icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-4xl drop-shadow-lg"
            style={{ filter: `drop-shadow(0 0 12px ${theme.accent}66)` }}
          >
            {theme.icon}
          </span>
        </div>
        {/* accent line */}
        <div
          className="absolute bottom-0 left-0 h-[2px] w-full"
          style={{ background: `linear-gradient(90deg, ${theme.accent}, transparent)` }}
        />
        {/* toggle */}
        <button
          onClick={toggle}
          className={clsx(
            "no-drag absolute right-2 top-2 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 backdrop-blur-sm transition-colors",
            enabled
              ? "bg-ok/15 text-ok ring-ok/30"
              : "bg-black/30 text-white/50 ring-white/10"
          )}
        >
          {enabled ? "Ativado" : "Desativado"}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-[13px] font-semibold leading-tight text-white">{title}</h3>
        <p className="text-[11px] leading-snug text-white/45">{description}</p>
        {enabled && (
          <div className="fade-slide-in mt-auto pt-2">{children}</div>
        )}
      </div>
    </div>
  );
}
