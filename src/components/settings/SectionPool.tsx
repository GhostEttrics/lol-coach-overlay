// Champion pool editor: 5 role rows of champion chips + an "Adicionar" button
// that opens a searchable champion picker.

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useStore, defaultSettings } from "@/store";
import { saveSettings } from "@/hooks/useBootstrap";
import { SectionCard } from "./widgets";
import { t, tx } from "@/i18n";
import { ROLES, type Role } from "@/types";

export function SectionPool() {
  const patch = useStore((s) => s.patch);
  const settings = useStore((s) => s.settings);
  const lang = settings.lang;
  const [picker, setPicker] = useState<Role | null>(null);

  function setRole(role: Role, ids: string[]) {
    saveSettings({ ...settings, pool: { ...(settings.pool ?? {}), [role]: ids } });
  }

  return (
    <SectionCard title={t(lang, "pool")} onReset={() => saveSettings({ ...settings, pool: {} })}>
      <div className="flex flex-col gap-3">
        {ROLES.map((role) => {
          const ids = settings.pool?.[role] ?? [];
          return (
            <div key={role} className="flex items-start gap-3">
              <div className="w-20 flex-shrink-0 pt-1.5">
                <span className="text-[11px] font-bold tracking-wider text-white/60 px-2 py-1 rounded bg-white/5">{tx(lang, `role.${role}`)}</span>
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                {ids.map((id) => {
                  const c = patch?.champion.data[id];
                  return (
                    <button
                      key={id}
                      onClick={() => setRole(role, ids.filter((x) => x !== id))}
                      className="group flex flex-col items-center gap-0.5"
                      title={t(lang, "removeChamp", { name: c?.name ?? id })}
                    >
                      <div className="relative">
                        <img src={patch ? `${patch.cdn}/img/champion/${c?.image.full}` : ""} alt="" className="w-11 h-11 rounded-lg ring-1 ring-white/10 group-hover:ring-danger/50 group-hover:opacity-60" />
                        <span className="absolute inset-0 hidden group-hover:flex items-center justify-center text-danger font-bold">✕</span>
                      </div>
                      <span className="text-[9px] text-white/50 max-w-[48px] truncate">{c?.name ?? id}</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setPicker(role)}
                  className="w-11 h-11 rounded-lg ring-1 ring-dashed ring-accent/40 text-accent/70 hover:text-accent hover:ring-accent/70 flex items-center justify-center text-lg"
                  title={t(lang, "addChamp")}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-white/40 mt-3">{t(lang, "poolHint")}</div>

      {picker && (
        <ChampPicker
          role={picker}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            const ids = settings.pool?.[picker] ?? [];
            if (!ids.includes(id)) setRole(picker, [...ids, id]);
          }}
        />
      )}
    </SectionCard>
  );
}

function ChampPicker({ role, onPick, onClose }: { role: Role; onPick: (id: string) => void; onClose: () => void }) {
  const patch = useStore((s) => s.patch);
  const lang = useStore((s) => s.settings.lang);
  const owned = useStore((s) => s.settings.pool?.[role] ?? []);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    if (!patch) return [];
    const needle = q.trim().toLowerCase();
    return Object.values(patch.champion.data)
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [patch, q]);

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[70vh] rounded-2xl bg-app ring-1 ring-white/10 p-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t(lang, "searchChamp")}
            className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-[13px] outline-none ring-1 ring-white/10 focus:ring-accent/40"
          />
          <button onClick={onClose} className="text-white/50 hover:text-white text-sm px-2">✕</button>
        </div>
        <div className="grid grid-cols-6 gap-2 overflow-y-auto">
          {list.map((c) => {
            const has = owned.includes(c.id);
            return (
              <button key={c.id} onClick={() => onPick(c.id)} className={clsx("flex flex-col items-center gap-1 p-1 rounded-lg", has ? "ring-1 ring-ok/50 bg-ok/5" : "hover:bg-white/5")}>
                <img src={patch ? `${patch.cdn}/img/champion/${c.image.full}` : ""} alt="" className="w-11 h-11 rounded-lg" />
                <span className="text-[9px] text-white/60 truncate max-w-full">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { defaultSettings };
