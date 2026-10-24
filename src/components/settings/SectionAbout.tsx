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
      <div className="text-[11px] text-white/35 mt-3 leading-relaxed">{t(lang, "aboutDisclaimer")}</div>
    </SectionCard>
  );
}
