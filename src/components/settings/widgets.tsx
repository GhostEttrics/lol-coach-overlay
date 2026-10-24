// Shared settings widgets: section header with reset, iOS toggle, segmented
// control, slider.

import clsx from "clsx";
import { useStore, defaultSettings } from "@/store";
import { saveSettings } from "@/hooks/useBootstrap";
import type { UserSettings } from "@/types";

export function patchSettings(fn: (s: UserSettings) => UserSettings) {
  saveSettings(fn(structuredClone(useStore.getState().settings)));
}

export function SectionCard({ title, onReset, children }: { title: string; onReset?: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card ring-1 ring-white/[0.07] p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {onReset && (
          <button onClick={onReset} className="text-[11px] text-white/45 hover:text-white/75 flex items-center gap-1 px-2 py-1 rounded ring-1 ring-white/10">
            ↺ RESET
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-[13px] text-white/85">{label}</div>
        {hint && <div className="text-[11px] text-white/40 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ value, onChange, danger }: { value: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={clsx("w-11 h-6 rounded-full relative transition-colors", value ? (danger ? "bg-danger/70" : "bg-accent") : "bg-white/15")}
    >
      <span className={clsx("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all", value ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-white/5 p-0.5">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} className={clsx("px-3 py-1 text-[12px] rounded-md transition", value === o.v ? "bg-accent/20 text-accent" : "text-white/50 hover:text-white/75")}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export { defaultSettings };
