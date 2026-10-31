import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F1EEE6",
        surface: "#FAF9F4",
        raised: "#FDFCF9",
        ink: {
          DEFAULT: "#16211E",
          soft: "#3F4C47",
          mute: "#6B7671",
          faint: "#929C96",
        },
        line: {
          DEFAULT: "#DCD7CA",
          strong: "#C9C3B3",
        },
        forest: {
          50: "#EEF4F0",
          100: "#DCE9E1",
          200: "#B9D3C2",
          300: "#8DB69D",
          400: "#5D9276",
          500: "#3C735B",
          600: "#285C47",
          700: "#1E4939",
          800: "#173B30",
          900: "#123027",
          950: "#0B211B",
        },
        navy: {
          50: "#EEF2F7",
          100: "#DCE4EE",
          200: "#B9C8DB",
          300: "#8CA5C2",
          400: "#5C7FA5",
          500: "#3E6288",
          600: "#2C4B6D",
          700: "#233D59",
          800: "#1D324A",
          900: "#182A3D",
        },
        clay: {
          50: "#F7F1E7",
          100: "#EEE1CE",
          200: "#DFC6A5",
          300: "#CBA679",
          400: "#B88A55",
          500: "#A37542",
          600: "#8A5D34",
          700: "#704A2C",
          800: "#5C3E28",
          900: "#4D3424",
        },
        danger: {
          50: "#FBEEEC",
          100: "#F6DCD8",
          200: "#EAB9B1",
          300: "#DB8E82",
          400: "#C96556",
          500: "#B24A3C",
          600: "#963A30",
          700: "#7B3029",
          800: "#662B25",
          900: "#562722",
        },
        success: {
          50: "#EBF5EF",
          100: "#D7EBDD",
          200: "#ADD6BB",
          300: "#7CBA92",
          400: "#4F9D6C",
          500: "#348054",
          600: "#256744",
          700: "#1E5238",
          800: "#1A422F",
          900: "#163728",
        },
      },
      fontFamily: {
        sans: [
          "Manrope Variable",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        serif: ["Newsreader Variable", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.68rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(22, 33, 30, 0.04), 0 8px 24px -16px rgba(22, 33, 30, 0.18)",
        lift: "0 2px 4px rgba(22, 33, 30, 0.05), 0 20px 40px -24px rgba(22, 33, 30, 0.28)",
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "dialog-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out",
        "dialog-in": "dialog-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "toast-in": "toast-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
