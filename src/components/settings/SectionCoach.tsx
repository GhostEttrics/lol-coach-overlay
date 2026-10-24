import { useStore } from "@/store";
import { SectionCard, Row, Seg, Toggle, patchSettings } from "./widgets";
import type { DetailLevel } from "@/types";
import { t } from "@/i18n";

export function SectionCoach() {
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  return (
    <SectionCard title="Coach">
      <Row label={t(lang, "detail")} hint={t(lang, "detailHint")}>
        <Seg<DetailLevel>
          value={settings.detail_level}
          options={[{ v: "low", l: t(lang, "detailLow") }, { v: "medium", l: t(lang, "detailMid") }, { v: "high", l: t(lang, "detailHigh") }]}
          onChange={(v) => patchSettings((s) => ((s.detail_level = v), s))}
        />
      </Row>
      <Row label={t(lang, "voice")} hint={t(lang, "voiceHint")}>
        <Toggle value={settings.notify?.voice ?? false} onChange={(v) => patchSettings((s) => ((s.notify.voice = v), s))} />
      </Row>
    </SectionCard>
  );
}
