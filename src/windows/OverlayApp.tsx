// In-game overlay: small, fixed size, no scroll. Shows only the essentials.
// Long tips live in the panel now.
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import { useBootstrap, saveSettings } from "@/hooks/useBootstrap";
import { useGameData } from "@/hooks/useGameData";
import { useMyRole } from "@/hooks/useMyRole";
import { useChampSelect } from "@/hooks/useChampSelect";
import { OverlayItem } from "@/components/overlay/OverlayItem";
import { OverlayDraft } from "@/components/overlay/OverlayDraft";
import { ObjectiveStrip } from "@/components/overlay/ObjectiveStrip";
import { AdvantageBadge } from "@/components/Badge";
import { t } from "@/i18n";

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

  useEffect(() => {
    const un = listen("hotkey", () => {});
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (notify?.sound_affordable && data.rec?.canAffordNow)
      invoke("play_sound").catch(() => {});
  }, [notify?.sound_affordable, data.rec?.canAffordNow, data.rec?.itemId]);

  if (minimized) {
    return (
      <div
        className="glass flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-[11px] font-bold text-accent"
        onClick={() =>
          saveSettings({
            ...useStore.getState().settings,
            overlay: { ...useStore.getState().settings.overlay, minimized: false },
          })
        }
      >
        LC
      </div>
    );
  }

  const champIcon = data.champIcon;

  return (
    <div className="glass w-[280px] overflow-hidden rounded-2xl">
      {/* Header (drag region) */}
      <div className="drag flex items-center gap-2 border-b border-white/8 px-3 py-2">
        {champIcon && inGame ? (
          <img
            src={champIcon}
            alt=""
            className="h-6 w-6 rounded-full object-cover ring-1 ring-cyan-400/40"
          />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
            LC
          </span>
        )}
        <div className="flex-1 truncate text-[12px] font-semibold uppercase tracking-wide text-white">
          {inGame ? data.champName : inDraft ? "DRAFT" : "LoL Coach"}
          {inGame && role && (
            <span className="ml-1.5 font-normal text-accent/80">· {role.role}</span>
          )}
        </div>
        {live && <AdvantageBadge live={live} diff={data.goldDiff} />}
        <div className="no-drag flex items-center gap-1">
          <IconBtn
            title="Painel"
            onClick={() => invoke("open_window", { label: "panel" })}
          >
            ▦
          </IconBtn>
          <IconBtn
            title="Silêncio"
            active={silent}
            onClick={() =>
              saveSettings({
                ...useStore.getState().settings,
                overlay: {
                  ...useStore.getState().settings.overlay,
                  silent: !silent,
                },
              })
            }
          >
            {silent ? "🔇" : "🔈"}
          </IconBtn>
          <IconBtn
            title="Config"
            onClick={() => invoke("open_window", { label: "settings" })}
          >
            ⚙
          </IconBtn>
          <IconBtn
            title="Minimizar"
            onClick={() =>
              saveSettings({
                ...useStore.getState().settings,
                overlay: { ...useStore.getState().settings.overlay, minimized: true },
              })
            }
          >
            —
          </IconBtn>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        {!inGame && inDraft ? (
          <OverlayDraft />
        ) : inGame ? (
          <div className="flex flex-col gap-2.5">
            <OverlayItem data={data} />
            {!silent && <ObjectiveStrip data={data} />}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-4 text-center">
            <div className="text-2xl">🛡️</div>
            <div className="text-[12px] font-semibold text-white/80">
              {t(lang, "ingameOff")}
            </div>
            <div className="text-[11px] text-white/45">
              {lang === "pt-BR"
                ? "Entre numa fila ou partida."
                : "Queue or start a match."}
            </div>
            {!interactive && (
              <div className="mt-1 rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/40 ring-1 ring-white/10">
                Ctrl+F1 {lang === "pt-BR" ? "para clicar" : "to click"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  active,
  onClick,
}: {
  children: ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={clsx(
        "flex h-6 w-6 items-center justify-center rounded-md text-[11px] transition-colors",
        active
          ? "bg-accent/20 text-accent"
          : "text-white/50 hover:bg-white/10 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}
