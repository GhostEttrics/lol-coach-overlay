// In-game overlay: small, fixed size, no scroll. Shows only the essentials.
// Long tips live in the panel now.

import { useEffect } from "react";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import { useBootstrap, saveSettings } from "@/hooks/useBootstrap";
import { useGameData } from "@/hooks/useGameData";
import { useMyRole, cycleRole } from "@/hooks/useMyRole";
import { useChampSelect } from "@/hooks/useChampSelect";
import { OverlayItem } from "@/components/overlay/OverlayItem";
import { OverlayDraft } from "@/components/overlay/OverlayDraft";
import { ObjectiveStrip } from "@/components/overlay/ObjectiveStrip";
import { AdvantageBadge } from "@/components/Badge";
import { t, tx } from "@/i18n";

export default function OverlayApp() {
  const { lastEvent } = useBootstrap({ engine: true });
  const inGame = useStore((s) => s.inGame);
  const minimized = useStore((s) => s.minimized);
  const silent = useStore((s) => s.silent);
  const interactive = useStore((s) => s.interactive);
  const live = useStore((s) => s.live);
  const lang = useStore((s) => s.settings.lang);
  const notify = useStore((s) => s.settings.notify);
  const data = useGameData(lastEvent);
  const role = useMyRole();
  const inDraft = !!useChampSelect();

  // "view" toggled by F2 (item) / F3 (draft), relayed from Rust.
  useEffect(() => {
    const un = listen<string>("hotkey", () => {});
    return () => {
      un.then((f) => f());
    };
  }, []);

  // Sound when the recommended item becomes affordable.
  useEffect(() => {
    if (notify?.sound_affordable && data.rec?.canAffordNow) invoke("play_sound").catch(() => {});
  }, [notify?.sound_affordable, data.rec?.canAffordNow, data.rec?.itemId]);

  if (minimized) {
    return (
      <div className="w-screen h-screen">
        <button
          onClick={() => saveSettings({ ...useStore.getState().settings, overlay: { ...useStore.getState().settings.overlay, minimized: false } })}
          className="no-drag w-full h-full rounded-lg glass flex items-center justify-center text-accent font-bold text-sm ring-1 ring-accent/30"
          title="Expandir (F6)"
        >
          LC
        </button>
      </div>
    );
  }

  const champIcon = data.champIcon;

  return (
    <div className="w-screen h-screen glass rounded-xl overflow-hidden flex flex-col text-white select-none">
      <header className="drag flex items-center gap-1.5 px-2.5 h-7 border-b border-white/5 flex-shrink-0">
        {champIcon && inGame ? (
          <img src={champIcon} alt="" className="w-5 h-5 rounded-full ring-1 ring-white/10" />
        ) : (
          <span className={clsx("w-1.5 h-1.5 rounded-full", inGame ? "bg-ok" : inDraft ? "bg-accent" : "bg-white/20")} />
        )}
        <span className="text-[11px] font-semibold tracking-wide text-white/85 truncate max-w-[88px]">
          {inGame ? data.champName : inDraft ? "DRAFT" : "LoL Coach"}
        </span>
        {inGame && role && (
          <button
            onClick={() => cycleRole(role.role)}
            title={tx(lang, `roleSource.${role.source}`)}
            className={clsx(
              "no-drag text-[9px] font-bold tracking-wider px-1 py-px rounded ring-1",
              role.source === "game" || role.source === "draft" ? "bg-accent/10 text-accent ring-accent/30" : "bg-warn/10 text-warn ring-warn/40"
            )}
          >
            {tx(lang, `role.${role.role}`)}{role.source === "inferred" ? "?" : ""}
          </button>
        )}
        {live && <AdvantageBadge live={live} />}
        <div className="ml-auto flex items-center gap-0.5 no-drag">
          <IconBtn title="Painel (Ctrl+Shift+O)" onClick={() => invoke("open_window", { label: "panel" })}>▦</IconBtn>
          <IconBtn
            title={t(lang, "silent") + " (F4)"}
            active={silent}
            onClick={() => saveSettings({ ...useStore.getState().settings, overlay: { ...useStore.getState().settings.overlay, silent: !silent } })}
          >
            {silent ? "🔇" : "🔈"}
          </IconBtn>
          <IconBtn title="Configurações" onClick={() => invoke("open_window", { label: "settings" })}>⚙</IconBtn>
          <IconBtn
            title="Minimizar (F6)"
            onClick={() => saveSettings({ ...useStore.getState().settings, overlay: { ...useStore.getState().settings.overlay, minimized: true } })}
          >
            —
          </IconBtn>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        {!inGame && inDraft ? (
          <OverlayDraft />
        ) : inGame ? (
          silent ? (
            <div className="h-full flex items-center px-3">
              <ObjectiveStrip data={data} showScore />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 min-h-0">
                <OverlayItem data={data} />
              </div>
              <div className="border-t border-white/5 flex-shrink-0">
                <ObjectiveStrip data={data} />
              </div>
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-3 text-center">
            <div className="text-[12px] text-white/55">{t(lang, "ingameOff")}</div>
            <div className="text-[9px] text-white/35 mt-1">
              {lang === "pt-BR" ? "Entre numa fila ou partida." : "Queue or start a match."}
            </div>
            {!interactive && (
              <div className="mt-2 flex items-center gap-1 text-[9px] text-white/35">
                <kbd className="px-1 py-0.5 rounded bg-white/10 ring-1 ring-white/10">Ctrl+F1</kbd>
                <span>{lang === "pt-BR" ? "para clicar" : "to click"}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, title, active, onClick }: { children: React.ReactNode; title: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx("text-[10px] w-5 h-5 rounded flex items-center justify-center transition", active ? "bg-warn/15 text-warn" : "text-white/40 hover:text-white/75")}
    >
      {children}
    </button>
  );
}
