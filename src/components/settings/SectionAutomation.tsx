import { useStore, defaultSettings } from "@/store";
import { SectionCard, Row, Toggle, patchSettings } from "./widgets";
import { saveSettings } from "@/hooks/useBootstrap";
import { t } from "@/i18n";

export function SectionAutomation() {
  const settings = useStore((s) => s.settings);
  const a = settings.automation;
  const notify = settings.notify;
  const lang = settings.lang;

  return (
    <SectionCard title={t(lang, "automation")} onReset={() => saveSettings({ ...settings, automation: defaultSettings.automation })}>
      <Row label={t(lang, "autoAccept")} hint={t(lang, "autoAcceptHint")}>
        <Toggle value={a.auto_accept} onChange={(v) => patchSettings((s) => ((s.automation.auto_accept = v), s))} />
      </Row>
      <Row label={t(lang, "autoImportRunes")} hint={t(lang, "autoRunesHint")}>
        <Toggle value={a.auto_import_runes} onChange={(v) => patchSettings((s) => ((s.automation.auto_import_runes = v), s))} />
      </Row>
      <Row label={t(lang, "autoBuy")} hint={t(lang, "autoBuyWarning")}>
        <Toggle value={a.auto_buy} danger onChange={(v) => patchSettings((s) => ((s.automation.auto_buy = v), s))} />
      </Row>
      <Row label={t(lang, "soundAffordable")}>
        <Toggle value={notify?.sound_affordable ?? false} onChange={(v) => patchSettings((s) => ((s.notify.sound_affordable = v), s))} />
      </Row>
    </SectionCard>
  );
}
