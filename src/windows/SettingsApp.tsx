// Settings window: sidebar + sections (mockup #2). All changes save
// immediately and broadcast to the other windows.

import { useState } from "react";
import clsx from "clsx";
import { useStore } from "@/store";
import { useBootstrap } from "@/hooks/useBootstrap";
import { SectionPool } from "@/components/settings/SectionPool";
import { SectionGeneral } from "@/components/settings/SectionGeneral";
import { SectionAutomation } from "@/components/settings/SectionAutomation";
import { SectionOverlay } from "@/components/settings/SectionOverlay";
import { SectionCoach } from "@/components/settings/SectionCoach";
import { SectionNotify } from "@/components/settings/SectionNotify";
import { SectionAbout } from "@/components/settings/SectionAbout";
import { t } from "@/i18n";

type Sec = "general" | "pool" | "automation" | "overlay" | "coach" | "notify" | "about";

export default function SettingsApp() {
  useBootstrap();
  const lang = useStore((s) => s.settings.lang);
  const [sec, setSec] = useState<Sec>("pool");

  const items: { id: Sec; label: string; icon: string }[] = [
    { id: "general", label: t(lang, "secGeneral"), icon: "⚙" },
    { id: "pool", label: t(lang, "pool"), icon: "👥" },
    { id: "automation", label: t(lang, "automation"), icon: "⏱" },
    { id: "overlay", label: "Overlay", icon: "▭" },
    { id: "coach", label: "Coach", icon: "🎓" },
    { id: "notify", label: t(lang, "secNotify"), icon: "🔔" },
    { id: "about", label: t(lang, "secAbout"), icon: "ⓘ" },
  ];

  return (
    <div className="min-h-screen flex bg-app text-white">
      <aside className="w-60 flex-shrink-0 border-r border-white/5 p-4">
        <div className="flex items-center gap-2 px-2 mb-6">
          <span className="w-8 h-8 rounded-lg bg-accent/15 ring-1 ring-accent/40 flex items-center justify-center text-accent font-bold text-sm">LC</span>
          <span className="text-[15px] font-semibold">LoL Coach</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {items.map((x) => (
            <button
              key={x.id}
              onClick={() => setSec(x.id)}
              className={clsx("flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-left transition", sec === x.id ? "bg-accent/10 text-accent ring-1 ring-accent/20" : "text-white/55 hover:text-white/80 hover:bg-white/5")}
            >
              <span className="w-4 text-center opacity-70">{x.icon}</span>
              {x.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 p-8 overflow-y-auto max-h-screen">
        <div className="max-w-3xl mx-auto">
          {sec === "general" && <SectionGeneral />}
          {sec === "pool" && <SectionPool />}
          {sec === "automation" && <SectionAutomation />}
          {sec === "overlay" && <SectionOverlay />}
          {sec === "coach" && <SectionCoach />}
          {sec === "notify" && <SectionNotify />}
          {sec === "about" && <SectionAbout />}
        </div>
      </main>
    </div>
  );
}
