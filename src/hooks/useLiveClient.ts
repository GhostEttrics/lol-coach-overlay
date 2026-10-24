import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "@/store";
import type { GameEvent, LiveSnapshot } from "@/types";

// Subscribes once. The event handler is kept in a ref so a new callback on
// every render does not tear down and recreate the listeners (the previous
// version did, once per second, and could drop events in between).
export function useLiveClient(onEvent?: (ev: GameEvent) => void) {
  const setLive = useStore((s) => s.setLive);
  const setInGame = useStore((s) => s.setInGame);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    const un1 = listen<LiveSnapshot>("ingame:snapshot", (e) => setLive(e.payload));
    const un2 = listen<boolean>("ingame:start", () => setInGame(true));
    const un3 = listen<boolean>("ingame:end", () => {
      setInGame(false);
      setLive(null);
    });
    const un4 = listen<GameEvent>("ingame:event", (e) => handler.current?.(e.payload));
    return () => {
      for (const u of [un1, un2, un3, un4]) u.then((f) => f());
    };
  }, [setLive, setInGame]);
}
