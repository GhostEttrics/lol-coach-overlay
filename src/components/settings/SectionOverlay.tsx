import clsx from "clsx";
import { useStore, defaultSettings } from "@/store";
import { SectionCard, Row, Toggle, patchSettings } from "./widgets";
import { saveSettings } from "@/hooks/useBootstrap";
import { t } from "@/i18n";

const CORNERS = [
  { v: "top-left", a: "↖" },
  { v: "top-right", a: "↗" },
  { v: "bottom-left", a: "↙" },
  { v: "bottom-right", a: "↘" },
] as const;

export function SectionOverlay() {
  const settings = useStore((s) => s.settings);
  const o = settings.overlay;
  const lang = settings.lang;

  return (
    <SectionCard title="Overlay" onReset={() => saveSettings({ ...settings, overlay: { ...defaultSettings.overlay } })}>
      <Row label={t(lang, "widgetSize")}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={60}
            max={160}
            step={10}
            value={Math.round(o.scale * 100)}
            onChange={(e) => patchSettings((s) => ((s.overlay.scale = Number(e.target.value) / 100), s))}
            className="w-40 accent-accent"
          />
          <span className="text-[12px] text-white/60 font-mono w-10">{Math.round(o.scale * 100)}%</span>
        </div>
      </Row>
      <Row label={t(lang, "screenCorner")}>
        <div className="grid grid-cols-2 gap-1">
          {CORNERS.map((c) => (
            <button
              key={c.v}
              onClick={() => patchSettings((s) => ((s.overlay.corner = c.v), s))}
              className={clsx("w-8 h-8 rounded ring-1 text-sm", o.corner === c.v ? "bg-accent/20 text-accent ring-accent/50" : "text-white/40 ring-white/10 hover:text-white/70")}
            >
              {c.a}
            </button>
          ))}
        </div>
      </Row>
      <Row label={t(lang, "showTips")} hint={t(lang, "showTipsHint")}>
        <Toggle value={o.show_tips} onChange={(v) => patchSettings((s) => ((s.overlay.show_tips = v), s))} />
      </Row>
      <Row label={t(lang, "silentMode")} hint="F4">
        <Toggle value={o.silent} onChange={(v) => patchSettings((s) => ((s.overlay.silent = v), s))} />
      </Row>
      <Row label={t(lang, "startMinimized")} hint="F6">
        <Toggle value={o.minimized} onChange={(v) => patchSettings((s) => ((s.overlay.minimized = v), s))} />
      </Row>
    </SectionCard>
  );
}
