import { useStore } from "@/store";
import { SectionCard, Row, Toggle, patchSettings } from "./widgets";
import { t } from "@/i18n";

export function SectionNotify() {
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  const n = settings.notify;
  return (
    <SectionCard title={t(lang, "secNotify")}>
      <Row label={t(lang, "soundAffordable")} hint={t(lang, "soundAffordableHint")}>
        <Toggle value={n?.sound_affordable ?? false} onChange={(v) => patchSettings((s) => ((s.notify.sound_affordable = v), s))} />
      </Row>
      <Row label={t(lang, "voice")} hint={t(lang, "voiceHint")}>
        <Toggle value={n?.voice ?? false} onChange={(v) => patchSettings((s) => ((s.notify.voice = v), s))} />
      </Row>
    </SectionCard>
  );
}
