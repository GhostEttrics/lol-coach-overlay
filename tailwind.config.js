/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"]
      },
      colors: {
        app: "#0a0e16",
        card: "rgba(255, 255, 255, 0.03)",
        panel: "rgba(10, 14, 22, 0.75)",
        panelLight: "rgba(248, 250, 252, 0.78)",
        accent: "#00d4ff",
        warn: "#fbbf24",
        danger: "#f87171",
        ok: "#4ade80"
      },
      boxShadow: {
        glass:
          "0 4px 24px -2px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};
