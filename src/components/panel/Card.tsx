// Panel card shell: title, description, an Ativado/Desativado toggle the user
// controls (persisted per card), and the live content. A disabled card shows
// only its header, so the user can declutter the dashboard.

import clsx from "clsx";
import { useStore, cardEnabled } from "@/store";
import { saveSettings } from "@/hooks/useBootstrap";

export function Card({
  id,
  title,
  description,
  children,
  wide,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const settings = useStore((s) => s.settings);
  const enabled = cardEnabled(settings, id);

  const toggle = () => {
    const cards = { ...(settings.panel_cards as Record<string, boolean>), [id]: !enabled };
    saveSettings({ ...settings, panel_cards: cards });
  };

  return (
    <div
      className={clsx(
        "group rounded-2xl bg-card ring-1 ring-white/[0.07] p-4 flex flex-col transition-all duration-200",
        "hover:ring-accent/25 hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(0,212,255,0.08)]",
        wide && "md:col-span-2"
      )}
    >
      {enabled && <div className="flex-1 min-h-0 mb-3">{children}</div>}
      <div className={clsx("flex items-start justify-between gap-3", enabled && "pt-3 border-t border-white/5")}>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-white">{title}</div>
          <div className="text-[11px] text-white/45 leading-snug mt-0.5">{description}</div>
        </div>
      </div>
      <button
        onClick={toggle}
        className={clsx(
          "mt-3 self-start text-[11px] font-medium px-2.5 py-1 rounded-full ring-1 transition",
          enabled ? "bg-ok/15 text-ok ring-ok/30" : "bg-white/[0.04] text-white/45 ring-white/10"
        )}
      >
        {enabled ? "Ativado" : "Desativado"}
      </button>
    </div>
  );
}
