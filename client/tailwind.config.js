const tokens = require("../shared/design/tokens.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // Shared design tokens — single source of truth: shared/design/tokens.cjs.
      // Values equal the mobile app's prior palette (no regression); brand ramp,
      // `title` size, and rounded-card/field/pill are additive.
      colors: tokens.colors,
      fontSize: tokens.fontSize,
      borderRadius: tokens.borderRadius,
    },
  },
  plugins: [],
};
