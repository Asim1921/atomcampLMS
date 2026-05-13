import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        atom: {
          deep: "#070f1a",
          navy: "#0c1929",
          panel: "#111f33",
          border: "#1e3a5f",
          muted: "#8ba3be",
          text: "#e8f1fc",
          accent: "#2dd4bf",
          accent2: "#38bdf8",
          warn: "#fbbf24",
          danger: "#f87171",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(45, 212, 191, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
