import { useStore } from "@/store";
import { SectionCard, Row, Seg, Toggle, patchSettings } from "./widgets";
import type { Lang, Theme } from "@/types";
import { t } from "@/i18n";

export function SectionGeneral() {
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  return (
    <SectionCard title={t(lang, "secGeneral")}>
      <Row label={t(lang, "language")}>
        <Seg<Lang>
          value={settings.lang}
          options={[{ v: "pt-BR", l: "pt-BR" }, { v: "en", l: "English" }]}
          onChange={(v) => patchSettings((s) => ((s.lang = v), s))}
        />
      </Row>
      <Row label={t(lang, "theme")}>
        <Seg<Theme>
          value={settings.theme}
          options={[{ v: "dark", l: t(lang, "themeDark") }, { v: "light", l: t(lang, "themeLight") }]}
          onChange={(v) => patchSettings((s) => ((s.theme = v), s))}
        />
      </Row>
      <Row label={t(lang, "openPanelOnStart")} hint={t(lang, "openPanelOnStartHint")}>
        <Toggle value={settings.open_panel_on_start} onChange={(v) => patchSettings((s) => ((s.open_panel_on_start = v), s))} />
      </Row>
    </SectionCard>
  );
}
