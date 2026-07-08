/**
 * rstify design tokens — the single source of truth for BOTH frontends.
 *
 *   web-ui   (Tailwind 3.4)  → web-ui/tailwind.config.js  requires this file
 *   mobile   (NativeWind 4.2) → client/tailwind.config.js  requires this file
 *
 * Design direction: **Coinbase-INFORMED, rstify's own identity.**
 * The MOBILE app is already the target look (clean cards, blue primary, generous
 * rounding, restraint) — so these tokens CODIFY the mobile identity as the shared
 * source, and the job is to lift web-ui up to it. We reproduce the Coinbase *rhythm*,
 * never its exact wordmark, typeface (Coinbase Sans), or icon set.
 *
 * Palette was reasoned on an OKLCH ramp but ships as HEX: React Native (NativeWind)
 * cannot parse `oklch()`; hex is the only cross-platform-safe color format.
 *
 * RULES OF THE ROAD
 *  - This is the enforcement layer. Components use the token CLASSES (bg-primary,
 *    text-body, bg-brand-500, rounded-card …), never hardcoded hex. Change a value
 *    HERE, not in a component.
 *  - Key names are STABLE and the color VALUES equal the mobile app's proven current
 *    palette, so nothing regresses. The redesign refines values + layouts, not the
 *    vocabulary. Add keys; don't rename or delete.
 *  - Neutrals/greys come from Tailwind's built-in `slate` scale (already used across
 *    both apps) — we deliberately do NOT define a `neutral` key so we don't clobber
 *    Tailwind's default.
 *  - Coinbase-ward refinements (fuller brand ramp, generous radii, the `title` tier)
 *    are ADDITIVE and opt-in; adopt them per-screen during the redesign.
 *
 * `.cjs` on purpose: Tailwind loads its config in Node and `require()`s this directly,
 * before any bundler alias exists.
 */

// Brand blue ramp — anchored on the mobile app's current primary (#3B82F6). Use
// brand-600 for solid fills with white text; brand-500 for accents/links/active.
const brand = {
  50: '#EFF5FF',
  100: '#DBE8FE',
  200: '#BFD7FE',
  300: '#93BBFD',
  400: '#60A5FA',
  500: '#3B82F6', // === current mobile primary
  600: '#2563EB',
  700: '#1D4ED8',
  800: '#1E40AF',
  900: '#1E3A8A',
};

// Semantic status ramps (verbatim from the mobile app — do not regress).
const success = { DEFAULT: '#22C55E', light: '#4ADE80', dark: '#16A34A' };
const warning = { DEFAULT: '#F59E0B', light: '#FBBF24', dark: '#D97706' };
const error = { DEFAULT: '#EF4444', light: '#F87171', dark: '#DC2626' };
const info = { DEFAULT: '#06B6D4', light: '#22D3EE', dark: '#0891B2' };
const accent = { DEFAULT: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED' };

const colors = {
  brand, // NEW full ramp — brand-50 … brand-900

  // Primary === brand action blue (verbatim mobile shape + values).
  primary: { DEFAULT: brand[500], light: brand[400], dark: brand[600] },

  success,
  warning,
  error,
  info,
  accent,

  // Dark-mode surfaces (verbatim mobile — used via `dark:bg-surface-card`, etc.).
  surface: {
    bg: '#0F172A',
    card: '#1E293B',
    elevated: '#334155',
    overlay: '#475569',
  },
  // Light-mode surfaces (verbatim mobile).
  'surface-light': {
    bg: '#FFFFFF',
    card: '#F9FAFB',
    elevated: '#F3F4F6',
    overlay: '#E5E7EB',
  },
};

// Semantic type scale (px so it is valid in React Native; web accepts px too).
// display/heading/body/caption/code are verbatim mobile; `title` is the one new tier.
const fontSize = {
  display: ['28px', { lineHeight: '34px', fontWeight: '800', letterSpacing: '-0.5px' }],
  heading: ['18px', { lineHeight: '24px', fontWeight: '700' }],
  title: ['16px', { lineHeight: '22px', fontWeight: '600' }],
  body: ['14px', { lineHeight: '21px', fontWeight: '400' }],
  caption: ['11px', { lineHeight: '16px', fontWeight: '400' }],
  code: ['12px', { lineHeight: '18px', fontWeight: '400' }],
};

// Generous, Coinbase-like rounding. Additive — Tailwind's rounded-lg/xl/2xl remain.
const borderRadius = {
  card: '14px', // cards / sheets / large containers
  field: '10px', // inputs / buttons
  pill: '9999px', // chips / toggles / segmented controls
};

module.exports = { colors, brand, fontSize, borderRadius };
