const tokens = require('../shared/design/tokens.cjs')

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Shared design tokens — single source of truth: shared/design/tokens.cjs.
      // Gives web-ui the same primary/surface/semantic vocabulary the mobile app
      // already uses (bg-primary, bg-surface-card, text-body, rounded-card, …).
      colors: tokens.colors,
      fontSize: tokens.fontSize,
      borderRadius: tokens.borderRadius,
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
