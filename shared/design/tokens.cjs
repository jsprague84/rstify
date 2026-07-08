/**
 * rstify design tokens — the single source of truth for BOTH frontends.
 *
 *   web-ui   (Tailwind 3.4)  → web-ui/tailwind.config.js  requires this file
 *   mobile   (NativeWind 4.2) → client/tailwind.config.js  requires this file
 *
 * Design direction: **Coinbase palette + style, rstify's own product.**
 * We reproduce Coinbase's visual language — its signature saturated blue, cool
 * near-white / near-black neutrals, generous rounding, restraint, and whitespace —
 * because the mobile app is already headed that way and the web-ui needs to catch up.
 * This palette INTENTIONALLY shifts both apps (mobile moves too; it wasn't final).
 *
 * Legal firewall: hex color values and layout/rhythm are not protected. We never lift
 * Coinbase's wordmark, typeface (Coinbase Sans), icon set, or copy — those stay ours.
 *
 * Palette reasoned on an OKLCH ramp, shipped as HEX: React Native (NativeWind) cannot
 * parse `oklch()`; hex is the only cross-platform-safe color format.
 *
 * RULES OF THE ROAD
 *  - This is the enforcement layer. Components use the token CLASSES (bg-primary,
 *    text-body, bg-brand-500, rounded-card …), never hardcoded hex. Change a value
 *    HERE, not in a component.
 *  - Key names are STABLE — add keys, don't rename or delete; existing classes keep
 *    working, they just re-color.
 *  - Neutrals/greys come from Tailwind's built-in `slate` scale (already used across
 *    both apps) — we deliberately do NOT define a `neutral` key so we don't clobber
 *    Tailwind's default.
 *
 * `.cjs` on purpose: Tailwind loads its config in Node and `require()`s this directly,
 * before any bundler alias exists.
 */

// Brand — Coinbase-blue family (#0052FF core). brand-500 is the accent/link/active
// hue; brand-600 the pressed state. #0052FF has ~7.6:1 on white, so it doubles as a
// solid button fill with white text.
const brand = {
  50: '#EBF1FF',
  100: '#D6E4FF',
  200: '#ADC7FF',
  300: '#7AA1FF',
  400: '#3D74FF',
  500: '#0052FF', // Coinbase blue — primary
  600: '#0043D1', // hover / pressed
  700: '#0036A8',
  800: '#002C85',
  900: '#00246B',
};

// Semantic status ramps — Coinbase-tuned (green up, red down, restrained amber).
const success = { DEFAULT: '#05B169', light: '#1AD07E', dark: '#048A52' };
const warning = { DEFAULT: '#F5A623', light: '#FBBF24', dark: '#C97F0A' };
const error = { DEFAULT: '#E5484D', light: '#F87171', dark: '#C4292E' };
const info = { DEFAULT: '#0BA5EC', light: '#38BDF8', dark: '#0086C9' };
const accent = { DEFAULT: '#7A5AF8', light: '#9B8AFB', dark: '#6938EF' };

const colors = {
  brand, // full ramp — brand-50 … brand-900

  // Primary === Coinbase brand blue (shape preserved for existing bg-primary usage).
  primary: { DEFAULT: brand[500], light: brand[400], dark: brand[600] },

  success,
  warning,
  error,
  info,
  accent,

  // Dark-mode surfaces — Coinbase near-black, cool (used via `dark:bg-surface-card`).
  surface: {
    bg: '#0A0B0D',
    card: '#141619',
    elevated: '#1E2126',
    overlay: '#2A2E35',
  },
  // Light-mode surfaces — white with cool off-white sections.
  'surface-light': {
    bg: '#FFFFFF',
    card: '#F7F9FC',
    elevated: '#EFF2F7',
    overlay: '#E2E7EF',
  },
};

// Semantic type scale (px so it is valid in React Native; web accepts px too).
const fontSize = {
  display: ['28px', { lineHeight: '34px', fontWeight: '800', letterSpacing: '-0.5px' }],
  heading: ['18px', { lineHeight: '24px', fontWeight: '700', letterSpacing: '-0.2px' }],
  title: ['16px', { lineHeight: '22px', fontWeight: '600' }],
  body: ['14px', { lineHeight: '21px', fontWeight: '400' }],
  caption: ['11px', { lineHeight: '16px', fontWeight: '400' }],
  code: ['12px', { lineHeight: '18px', fontWeight: '400' }],
};

// Generous, Coinbase-like rounding. Additive — Tailwind's rounded-lg/xl/2xl remain.
const borderRadius = {
  card: '16px', // cards / sheets / large containers
  field: '12px', // inputs / buttons
  pill: '9999px', // chips / toggles / segmented controls / CTAs
};

module.exports = { colors, brand, fontSize, borderRadius };
