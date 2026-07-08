// Screenshot loop for the web-ui redesign.
//   node scripts/shot.mjs <route> <name>
// Env: SHOT_TOKEN (rstify JWT, injected into localStorage), SHOT_BASE (default
// http://localhost:5173), SHOT_OUT (output dir), CHROMIUM (browser executable).
// Captures the route at desktop (1440) and mobile (375) — the report's required
// small-width pass condition.
//
// NOTE: we load "/" and then CLICK the nav link for the route instead of hard-
// navigating, because the Vite dev proxy for "/message" prefix-matches the
// "/messages" route and would hijack a hard navigation to the backend.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EXECUTABLE = process.env.CHROMIUM || '/usr/bin/chromium';
const BASE = (process.env.SHOT_BASE || 'http://localhost:5173').replace(/\/$/, '');
const TOKEN = process.env.SHOT_TOKEN || '';
const OUT = process.env.SHOT_OUT || new URL('../.shots', import.meta.url).pathname;
const route = process.argv[2] || '/messages';
const name = (process.argv[3] || route).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root';
// Nav label to click in the sidebar (react-router NavLink); defaults to the
// capitalized route segment. Override with argv[4].
const navLabel = process.argv[4] || route.replace(/^\//, '').replace(/\b\w/, (c) => c.toUpperCase());

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXECUTABLE,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const [label, width, height, full] of [
    ['desktop', 1440, 900, true],
    ['mobile', 375, 812, false],
  ]) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    // Boot authed: set the token before any page script runs, on every navigation.
    if (TOKEN) await ctx.addInitScript((t) => localStorage.setItem('rstify_token', t), TOKEN);
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }).catch(() => {});
    if (route !== '/') {
      const link = page.getByRole('link', { name: navLabel, exact: true }).first();
      await link.waitFor({ timeout: 5000 }).catch(() => {});
      await link.click({ timeout: 5000 }).catch(() => {});
    }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    const file = `${OUT}/webui_${name}_${label}.png`;
    await page.screenshot({ path: file, fullPage: full });
    console.log('shot:', file);
    await ctx.close();
  }
} finally {
  await browser.close();
}
