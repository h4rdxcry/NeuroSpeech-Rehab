/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0d131f",
        surface: "#0d131f",
        "surface-container-lowest": "#080e1a",
        "surface-container-low": "#161c28",
        "surface-container": "#1a202c",
        "surface-container-high": "#242a37",
        "surface-container-highest": "#2f3542",
        "surface-bright": "#333947",
        "surface-dim": "#0d131f",
        "surface-variant": "#2f3542",
        "surface-tint": "#3bdae6",

        primary: "#4be4f0",
        "primary-container": "#14c8d4",
        "primary-fixed": "#7bf4ff",
        "primary-fixed-dim": "#3bdae6",
        "on-primary": "#00363a",
        "on-primary-container": "#004f54",

        secondary: "#4edea3",
        "secondary-container": "#00a572",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary": "#003824",
        "on-secondary-container": "#00311f",

        tertiary: "#ffc682",
        "tertiary-container": "#faa213",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",
        "on-tertiary": "#472a00",
        "on-tertiary-container": "#653e00",

        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",

        outline: "#859395",
        "outline-variant": "#3c494a",
        "on-surface": "#dde2f4",
        "on-surface-variant": "#bbc9ca",
        "inverse-surface": "#dde2f4",
        "inverse-on-surface": "#2b303e",
      },
      fontFamily: {
        space: ["Space Grotesk", "sans-serif"],
        noto: ["Noto Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        tamil: ["Noto Sans Tamil", "Noto Sans", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
      boxShadow: {
        "cyan-glow": "0 0 20px rgba(75, 228, 240, 0.35)",
        "cyan-lg": "0 0 30px rgba(75, 228, 240, 0.5)",
        "emerald-glow": "0 0 16px rgba(78, 222, 163, 0.35)",
        "amber-glow": "0 0 16px rgba(250, 162, 19, 0.35)",
      },
    },
  },
  plugins: [],
}
