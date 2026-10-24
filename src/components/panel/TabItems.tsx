// Items tab: the current recommendation in detail + the full build path with
// what you already own highlighted.

import { useStore } from "@/store";
import { templateFor } from "@/engine/buildTemplates";
import { planFromClientSet } from "@/engine/itemRecommender";
import { champOf, findMe } from "@/engine/role";
import { isLegendary, isT2Boots, srItem } from "@/engine/items";
import { GoldBar } from "@/components/GoldBar";
import { fmtGold, t } from "@/i18n";
import type { GameData } from "@/hooks/useGameData";
import clsx from "clsx";

export function TabItems({ data }: { data: GameData }) {
  const live = useStore((s) => s.live);
  const patch = useStore((s) => s.patch);
  const clientSet = useStore((s) => s.clientSet);
  const lang = useStore((s) => s.settings.lang);

  if (!live || !patch || !data.role || !data.me) {
    return <Center>{t(lang, "waitingLive")}</Center>;
  }

  const me = findMe(live)!;
  const owned = new Set(me.items.map((i) => String(i.itemID)));
  const tpl = templateFor(champOf(me, patch), data.role.role);
  const plan = planFromClientSet(clientSet, patch);
  const order = plan ? plan.core : tpl.core;
  const boots = plan?.boots ?? tpl.boots;
  const current = live.activePlayer.currentGold ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-5 flex flex-col gap-3">
        <div className="text-[13px] font-semibold text-white/80">{t(lang, "nextItem")}</div>
        {data.rec ? (
          <>
            <div className="flex items-center gap-3">
              <img src={data.rec.iconUrl} alt="" className="w-14 h-14 rounded-xl ring-1 ring-white/10" />
              <div>
                <div className="text-[16px] font-semibold">{data.rec.name}</div>
                <div className="text-[12px] text-white/50">{fmtGold(lang, data.rec.gold)}g</div>
              </div>
            </div>
            <GoldBar current={current} total={data.rec.gold} effectiveCost={data.rec.effectiveCost} lang={lang} />
            <div className="text-[12px] text-white/60">{data.rec.reason}</div>
            {data.rec.buyNow.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-white/45">{t(lang, "buyNow")}</span>
                {data.rec.buyNow.map((b, i) => (
                  <span key={`${b.itemId}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] ring-1 ring-white/10 pl-0.5 pr-2 py-0.5">
                    <img src={b.iconUrl} alt="" className="w-5 h-5 rounded-full" />
                    <span className="text-[11px] text-white/75">{b.name}</span>
                    <span className="text-[11px] text-white/45 font-mono">{fmtGold(lang, b.cost)}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-[12px] text-white/40">{t(lang, "waitingLive")}</div>
        )}
      </div>

      <div className="lg:col-span-2 rounded-2xl bg-card ring-1 ring-white/[0.07] p-5">
        <div className="text-[13px] font-semibold text-white/80 mb-3">{t(lang, "buildOrder")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <BuildIcon patch={patch} id={boots} owned={owned} highlight={data.rec?.itemId === Number(boots)} valid={isT2Boots(patch, boots)} />
          {order.map((id, i) => (
            <div key={`${id}-${i}`} className="flex items-center gap-2">
              <span className="text-white/20">›</span>
              <BuildIcon patch={patch} id={id} owned={owned} highlight={data.rec?.itemId === Number(id)} valid={isLegendary(patch, id)} />
            </div>
          ))}
        </div>
        <div className="text-[11px] text-white/35 mt-3">{t(lang, "buildOwnedHint")}</div>
      </div>
    </div>
  );
}

function BuildIcon({ patch, id, owned, highlight, valid }: { patch: GameData extends never ? never : any; id: string; owned: Set<string>; highlight: boolean; valid: boolean }) {
  const it = patch.item.data[id];
  if (!it || !valid || !srItem(patch, id)) return null;
  const has = owned.has(id);
  return (
    <div className="relative" title={it.name}>
      <img
        src={`${patch.cdn}/img/item/${it.image.full}`}
        alt=""
        className={clsx("w-11 h-11 rounded-lg ring-1 transition", has ? "ring-ok/60 opacity-100" : "ring-white/10 opacity-55", highlight && "ring-2 ring-accent")}
      />
      {has && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-ok text-black text-[10px] font-bold flex items-center justify-center">✓</span>}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="h-64 flex items-center justify-center text-[13px] text-white/35">{children}</div>;
}
