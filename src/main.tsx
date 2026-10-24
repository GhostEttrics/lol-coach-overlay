// Single bundle, three windows. The Tauri window label decides which root
// React tree mounts. All three share the same Zustand store, kept in sync via
// Tauri events (see useBootstrap).

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function windowLabel(): string {
  try {
    // Tauri injects the current window; the label is in the URL on the webview.
    const w = (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label;
    if (w) return w as string;
  } catch {
    /* ignore */
  }
  // Fallbacks for dev / browser preview.
  const q = new URLSearchParams(location.search).get("window");
  if (q) return q;
  return "overlay";
}

async function mount() {
  const label = windowLabel();
  document.documentElement.dataset.window = label;
  let Root: React.ComponentType;
  if (label === "panel") Root = (await import("./windows/PanelApp")).default;
  else if (label === "settings") Root = (await import("./windows/SettingsApp")).default;
  else Root = (await import("./windows/OverlayApp")).default;

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>
  );
}

mount();
