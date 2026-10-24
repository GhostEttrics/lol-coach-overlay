// One-line objective call for the overlay footer / silent bar.

import clsx from "clsx";
import { useStore } from "@/store";
import type { GameData } from "@/hooks/useGameData";

const ICON = { dragon: "🐉", elder: "🐲", baron: "👁", herald: "💀" } as const;

export function ObjectiveStrip({ data, showScore }: { data: GameData; showScore?: boolean }) {
  const lang = useStore((s) => s.settings.lang);
  const call = data.objective;
  const score = (
    <span className="text-[10px] text-white/45 font-mono flex-shrink-0" title={lang === "pt-BR" ? "dragões: vocês x inimigo" : "dragons: you x enemy"}>
      🐉 {data.dragonScore.mine}x{data.dragonScore.enemy}
    </span>
  );

  if (!call) {
    return <div className="flex items-center h-full px-3 py-1.5">{showScore ? score : <span className="text-[10px] text-white/30">—</span>}</div>;
  }

  const urgent = call.secondsLeft > 0 && call.secondsLeft < 15;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 w-full">
      <span className={clsx("text-[12px] leading-none flex-shrink-0", urgent && "animate-pulse-soft")}>{ICON[call.kind]}</span>
      <span
        className={clsx(
          "text-[10px] leading-snug truncate",
          call.severity === "crit" && "text-danger",
          call.severity === "warn" && "text-warn",
          call.severity === "info" && "text-white/75"
        )}
      >
        {call.text}
      </span>
      {showScore && <span className="ml-auto flex-shrink-0">{score}</span>}
    </div>
  );
}
