const tokens = require('../shared/design/tokens.cjs')
const defaultTheme = require('tailwindcss/defaultTheme')

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
      // Coinbase-substitute typefaces (loaded in main.tsx): Inter for UI, JetBrains
      // Mono for numbers. Web-only (mobile keeps system fonts until expo-font loads them).
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono Variable"', ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
