import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d12",
        elev: "#131722",
        elev2: "#1b2030",
        border: "#232a3d",
        text: "#e6eaf2",
        dim: "#8a93a8",
        accent: "#5b8cff",
        accent2: "#7bf0c0",
        danger: "#ff6b6b",
        warning: "#ffd166"
      }
    }
  },
  plugins: []
} satisfies Config;
