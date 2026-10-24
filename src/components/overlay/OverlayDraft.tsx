// Compact draft view for the overlay during champ select: role chips + bans +
// top 3 pool picks. The full draft board lives in the panel's Draft tab.

import { useMemo } from "react";
import clsx from "clsx";
import { useStore } from "@/store";
import { useChampSelect } from "@/hooks/useChampSelect";
import { useDraftRole } from "@/hooks/useGameContext";
import { chooseRole } from "@/hooks/useMyRole";
import { draftCoach } from "@/engine/draftCoach";
import { t, tx } from "@/i18n";
import { ROLES, type PatchData } from "@/types";
import { invoke } from "@tauri-apps/api/core";

function keyToId(patch: PatchData | null, key: number): string | null {
  if (!patch || !key) return null;
  const s = String(key);
  for (const [id, c] of Object.entries(patch.champion.data)) if (c.key === s) return id;
  return null;
}

export function OverlayDraft() {
  const patch = useStore((s) => s.patch);
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  const cs = useChampSelect();
  const { role } = useDraftRole();

  const picks = useMemo(() => {
    if (!cs || !patch) return { bans: [] as string[], mine: [] as string[], enemy: [] as string[] };
    const ids = (xs: number[]) => xs.map((n) => keyToId(patch, n)).filter((x): x is string => !!x);
    return {
      bans: ids(cs.bans),
      mine: ids(cs.my_team.filter((p) => !p.is_me).map((p) => p.champion_id)),
      enemy: ids(cs.their_team.map((p) => p.champion_id)),
    };
  }, [cs, patch]);

  const pool = role ? settings.pool?.[role] ?? [] : [];
  const sugg = useMemo(
    () => (patch && role ? draftCoach({ bans: picks.bans, myPicks: picks.mine, enemyPicks: picks.enemy, myPool: pool, myRole: role, patch, lang }) : []),
    [patch, role, picks, pool, lang]
  );

  if (!patch) return null;

  return (
    <div className="px-3 py-2 flex flex-col gap-1.5 h-full">
      <div className="flex items-center gap-1 no-drag">
        <span className="text-[9px] text-white/40 mr-0.5">{t(lang, "draftRolePick")}</span>
        {ROLES.map((r) => (
          <button
            key={r}
            onClick={() => chooseRole(r)}
            className={clsx("text-[9px] font-bold px-1 py-px rounded ring-1", role === r ? "bg-accent/15 text-accent ring-accent/40" : "text-white/40 ring-white/10 hover:text-white/70")}
          >
            {tx(lang, `role.${r}`)}
          </button>
        ))}
      </div>

      {pool.length === 0 ? (
        <button
          onClick={() => invoke("open_window", { label: "settings" })}
          className="no-drag text-left rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-2 text-[10px] text-white/70 hover:ring-accent/30"
        >
          ⚙ {role ? t(lang, "poolExplain", { role: tx(lang, `role.${role}`) }) : ""}
        </button>
      ) : (
        <ul className="flex flex-col gap-1">
          {sugg.map((s, i) => (
            <li key={s.championId} className="flex items-center gap-2 fade-slide-in">
              <span className="text-[9px] font-bold text-accent w-3">{i + 1}</span>
              <img src={s.iconUrl} alt="" className="w-6 h-6 rounded ring-1 ring-white/10" />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate leading-tight">{s.championName}</div>
                <div className="text-[9px] text-white/45 truncate">{s.reason}</div>
              </div>
            </li>
          ))}
          {sugg.length === 0 && <li className="text-[10px] text-white/40">{t(lang, "noSafePick")}</li>}
        </ul>
      )}
    </div>
  );
}
