import type { Config } from "tailwindcss";

// Sentire brand tokens (Sentire Designs logo kit, Payroll Admin Option B).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        orange: { DEFAULT: "#E8693A", press: "#C2552F", soft: "#FDEEE6", line: "#F6D3C2", text: "#A3431D" },
        ink: { DEFAULT: "#2A2420", soft: "#4A413A" },
        muted: "#6B6259",
        bg: "#F6F2EC",
        line: { DEFAULT: "#ECE6DD", strong: "#E2DACF", faint: "#F1ECE4" },
        sand: "#F2ECE4",
        paper: "#FBF8F4",
        espresso: { DEFAULT: "#2E241C", deep: "#1F1813", text: "#E9E2D8", dim: "#C4B8A9", label: "#B3A797" },
      },
      fontFamily: {
        head: ["'Instrument Sans'", "system-ui", "sans-serif"],
        body: ["'Hanken Grotesk'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
