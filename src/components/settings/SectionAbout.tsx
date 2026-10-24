import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { SectionCard, Row } from "./widgets";
import { t } from "@/i18n";

export function SectionAbout() {
  const lang = useStore((s) => s.settings.lang);
  const patch = useStore((s) => s.patch);
  const [logPath, setLogPath] = useState("");
  useEffect(() => {
    invoke<string>("get_log_path").then(setLogPath).catch(() => {});
  }, []);

  return (
    <SectionCard title={t(lang, "secAbout")}>
      <Row label="LoL Coach">
        <span className="text-[12px] text-white/50">v0.3</span>
      </Row>
      <Row label={t(lang, "dataPatch")}>
        <span className="text-[12px] text-white/50 font-mono">{patch?.version ?? "—"}</span>
      </Row>
      <Row label={t(lang, "logFile")}>
        <span className="text-[11px] text-white/40 font-mono max-w-[360px] truncate" title={logPath}>{logPath || "—"}</span>
      </Row>

      <div className="mt-5 pt-4 border-t border-white/5">
        <div className="text-[13px] font-semibold text-white/80 mb-2">{t(lang, "hotkeys")}</div>
        <div className="flex flex-col gap-1.5">
          {[
            { k: "F1", d: t(lang, "hkInteractive") },
            { k: "F2", d: t(lang, "hkItems") },
            { k: "F3", d: t(lang, "hkDraft") },
            { k: "F4", d: t(lang, "hkSilent") },
            { k: "F6", d: t(lang, "hkMinimize") },
            { k: "Ctrl+Shift+O", d: t(lang, "hkPanel") },
          ].map((h) => (
            <div key={h.k} className="flex items-center gap-3 text-[12px]">
              <kbd className="px-2 py-0.5 rounded bg-white/[0.08] ring-1 ring-white/10 font-mono text-white/80 min-w-[92px] text-center">{h.k}</kbd>
              <span className="text-white/55">{h.d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[11px] text-white/35 mt-4 leading-relaxed">{t(lang, "aboutDisclaimer")}</div>
    </SectionCard>
  );
}
