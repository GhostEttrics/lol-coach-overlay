// Full draft board for the panel: role chips, bans, both teams, and the top 3
// pool suggestions with composition reasons.

import { useMemo } from "react";
import clsx from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { useChampSelect } from "@/hooks/useChampSelect";
import { useDraftRole } from "@/hooks/useGameContext";
import { chooseRole } from "@/hooks/useMyRole";
import { draftCoach } from "@/engine/draftCoach";
import { t, tx } from "@/i18n";
import { ROLES, type PatchData, type Role } from "@/types";

function keyToId(patch: PatchData | null, key: number): string | null {
  if (!patch || !key) return null;
  const s = String(key);
  for (const [id, c] of Object.entries(patch.champion.data)) if (c.key === s) return id;
  return null;
}

export function TabDraft() {
  const patch = useStore((s) => s.patch);
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  const cs = useChampSelect();
  const { role } = useDraftRole();

  const d = useMemo(() => {
    if (!cs || !patch) return null;
    const ids = (xs: number[]) => xs.map((n) => keyToId(patch, n)).filter((x): x is string => !!x);
    return { bans: ids(cs.bans), mine: ids(cs.my_team.filter((p) => !p.is_me).map((p) => p.champion_id)), enemy: ids(cs.their_team.map((p) => p.champion_id)) };
  }, [cs, patch]);

  const pool = role ? settings.pool?.[role] ?? [] : [];
  const sugg = useMemo(
    () => (patch && role && d ? draftCoach({ bans: d.bans, myPicks: d.mine, enemyPicks: d.enemy, myPool: pool, myRole: role, patch, lang }) : []),
    [patch, role, d, pool, lang]
  );

  if (!patch) return null;
  if (!cs) {
    return (
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-8 text-center text-[13px] text-white/40">
        {lang === "pt-BR" ? "Entre no draft para ver as sugestões." : "Enter champ select to see suggestions."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-4 flex items-center gap-2 flex-wrap">
        <span className="text-[12px] text-white/50">{t(lang, "draftRolePick")}</span>
        {ROLES.map((r) => (
          <button key={r} onClick={() => chooseRole(r)} className={clsx("text-[12px] font-bold px-3 py-1 rounded-lg ring-1", role === r ? "bg-accent/15 text-accent ring-accent/40" : "text-white/45 ring-white/10 hover:text-white/70")}>
            {tx(lang, `role.${r}`)}
          </button>
        ))}
        {d && d.bans.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-white/35 uppercase tracking-wider">bans</span>
            {d.bans.map((b, i) => (
              <div key={`${b}-${i}`} className="relative" title={patch.champion.data[b]?.name}>
                <img src={`${patch.cdn}/img/champion/${patch.champion.data[b]?.image.full}`} alt="" className="w-7 h-7 rounded grayscale opacity-70" />
                <span className="absolute inset-0 flex items-center justify-center text-danger font-bold">✕</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Team title={lang === "pt-BR" ? "Seu time" : "Your team"} ids={d?.mine ?? []} patch={patch} tint="accent" />
        <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-4">
          <div className="text-[13px] font-semibold text-white/80 mb-3">{t(lang, "draftTitle")} · {role ? tx(lang, `role.${role}`) : ""}</div>
          {pool.length === 0 ? (
            <button onClick={() => invoke("open_window", { label: "settings" })} className="text-left w-full rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-3 text-[12px] text-white/70 hover:ring-accent/30">
              ⚙ {role ? t(lang, "poolExplain", { role: tx(lang, `role.${role}`) }) : ""}
            </button>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {sugg.map((s, i) => (
                <li key={s.championId} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-accent w-4">{i + 1}</span>
                  <img src={s.iconUrl} alt="" className="w-10 h-10 rounded-lg ring-1 ring-white/15" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{s.championName}</div>
                    <div className="text-[11px] text-white/50 truncate">{s.reason}</div>
                  </div>
                </li>
              ))}
              {sugg.length === 0 && <li className="text-[12px] text-white/40">{t(lang, "noSafePick")}</li>}
            </ul>
          )}
          <div className="text-[10px] text-white/30 mt-3">{t(lang, "noMatchupData")}</div>
        </div>
        <Team title={lang === "pt-BR" ? "Inimigos" : "Enemies"} ids={d?.enemy ?? []} patch={patch} tint="danger" />
      </div>
    </div>
  );
}

function Team({ title, ids, patch, tint }: { title: string; ids: string[]; patch: PatchData; tint: "accent" | "danger" }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-4">
      <div className="text-[13px] font-semibold text-white/80 mb-3">{title}</div>
      <div className="flex flex-col gap-2">
        {ids.length === 0 && <div className="text-[12px] text-white/30">—</div>}
        {ids.map((id, i) => {
          const c = patch.champion.data[id];
          return (
            <div key={`${id}-${i}`} className="flex items-center gap-2.5">
              <img src={`${patch.cdn}/img/champion/${c?.image.full}`} alt="" className={clsx("w-8 h-8 rounded-lg ring-1", tint === "accent" ? "ring-accent/30" : "ring-danger/30")} />
              <span className="text-[13px] text-white/80">{c?.name ?? id}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
