/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Serif display for H1/H2 only (wired via next/font variables in
        // src/app/layout.tsx); body stays sans.
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Warm elegant foundation: warm neutral page, deep espresso text,
        // restrained gold accent. Day-status green/amber/red semantics keep
        // their hue families and labels, warm-tinted (see
        // availability-calendar.tsx).
        cream: "#FDF9F4",
        espresso: "#2E2620",
        gold: {
          DEFAULT: "#B45309",
          deep: "#92400E",
          soft: "#F7EAD3",
        },
      },
    },
  },
  plugins: [],
};
