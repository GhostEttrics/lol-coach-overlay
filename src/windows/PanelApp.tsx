// Panel: a normal (non-transparent) window with a tabbed dashboard. The
// Painel tab is a grid of independent cards the user can toggle on/off.

import { useState } from "react";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { useBootstrap } from "@/hooks/useBootstrap";
import { useGameData } from "@/hooks/useGameData";
import { PanelGrid } from "@/components/panel/PanelGrid";
import { TabItems } from "@/components/panel/TabItems";
import { TabCoach } from "@/components/panel/TabCoach";
import { TabTimers } from "@/components/panel/TabTimers";
import { TabDraft } from "@/components/panel/TabDraft";
import { t } from "@/i18n";

type Tab = "panel" | "items" | "coach" | "timers" | "draft";

export default function PanelApp() {
  const { lastEvent } = useBootstrap();
  const data = useGameData(lastEvent);
  const lang = useStore((s) => s.settings.lang);
  const inGame = useStore((s) => s.inGame);
  const [tab, setTab] = useState<Tab>("panel");

  const tabs: { id: Tab; label: string }[] = [
    { id: "panel", label: "Painel" },
    { id: "items", label: "Itens" },
    { id: "coach", label: "Coach" },
    { id: "timers", label: "Timers" },
    { id: "draft", label: "Draft" },
  ];

  return (
    <div className="min-h-screen bg-app text-white">
      <header className="sticky top-0 z-10 flex items-center gap-6 px-6 h-16 bg-app/90 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center text-accent font-bold text-sm">LC</span>
          <span className="text-[15px] font-semibold tracking-tight">LoL Coach</span>
          <span className="text-white/30 text-[13px]">· Painel</span>
        </div>
        <nav className="flex items-center gap-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={clsx("relative px-3 py-2 text-[13px] font-medium transition", tab === x.id ? "text-white" : "text-white/45 hover:text-white/70")}
            >
              {x.label}
              {tab === x.id && <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className={clsx("text-[11px] px-2 py-1 rounded-full ring-1", inGame ? "bg-ok/10 text-ok ring-ok/30" : "bg-white/5 text-white/40 ring-white/10")}>
            {inGame ? "em jogo" : t(lang, "ingameOff")}
          </span>
          <button onClick={() => invoke("open_window", { label: "settings" })} className="text-[12px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-white/70">
            ⚙ {t(lang, "settings")}
          </button>
        </div>
      </header>

      <main className="p-6">
        {tab === "panel" && <PanelGrid data={data} />}
        {tab === "items" && <TabItems data={data} />}
        {tab === "coach" && <TabCoach data={data} />}
        {tab === "timers" && <TabTimers data={data} />}
        {tab === "draft" && <TabDraft />}
      </main>
    </div>
  );
}
