/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
        success: { DEFAULT: '#22c55e', light: '#4ade80', dark: '#16a34a' },
        warning: { DEFAULT: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
        error: { DEFAULT: '#ef4444', light: '#f87171', dark: '#dc2626' },
        accent: { DEFAULT: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed' },
        info: { DEFAULT: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
        surface: {
          bg: '#0f172a',
          card: '#1e293b',
          elevated: '#334155',
          overlay: '#475569',
        },
        'surface-light': {
          bg: '#ffffff',
          card: '#f9fafb',
          elevated: '#f3f4f6',
          overlay: '#e5e7eb',
        },
      },
      fontSize: {
        'display': ['28px', { lineHeight: '34px', fontWeight: '800', letterSpacing: '-0.5px' }],
        'heading': ['18px', { lineHeight: '24px', fontWeight: '700' }],
        'body': ['14px', { lineHeight: '21px', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '16px', fontWeight: '400' }],
        'code': ['12px', { lineHeight: '18px', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
