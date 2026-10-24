import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PatchData } from "@/types";
import { useStore } from "@/store";

// Loads Data Dragon for the current language. Reloads when the language
// changes and when the League client connects (the backend then knows the
// exact game version and picks the matching Data Dragon patch).
export function usePatch() {
  const setPatch = useStore((s) => s.setPatch);
  const lang = useStore((s) => s.settings.lang);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const un = listen("lcu:connected", () => setTick((n) => n + 1));
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await invoke<PatchData>("get_patch_data");
        if (!cancelled) setPatch(v);
      } catch (e) {
        console.error("get_patch_data failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setPatch, lang, tick]);
}
