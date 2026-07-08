// One-off verification walk of the new webhook create flow + modals.
//   SHOT_TOKEN=<jwt> node scripts/webhook-flow-shots.mjs [dark]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EXECUTABLE = process.env.CHROMIUM || '/usr/bin/chromium';
const BASE = 'http://localhost:5173';
const TOKEN = process.env.SHOT_TOKEN || '';
const THEME = process.argv[2] === 'dark' ? 'dark' : 'light';
const OUT = new URL('../.shots', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXECUTABLE, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript((t) => localStorage.setItem('rstify_token', t), TOKEN);
await ctx.addInitScript((theme) => {
  localStorage.setItem('rstify_theme', theme);
  if (theme === 'dark') document.documentElement.classList.add('dark');
}, THEME);
const page = await ctx.newPage();

const shot = async (name) => {
  await page.waitForTimeout(600);
  const file = `${OUT}/whflow_${THEME}_${name}.png`;
  await page.screenshot({ path: file });
  console.log('shot:', file);
};

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.getByRole('link', { name: 'Webhooks', exact: true }).click();
await page.waitForLoadState('networkidle');

// 1. Create flow: direction chooser
await page.getByRole('button', { name: 'New webhook' }).click();
await shot('1_direction');

// 2. Incoming form (GitHub selected by default)
await page.getByRole('button', { name: '↓ Receive notifications', exact: false }).click();
await shot('2_incoming_form');

// 3. Fill + create → success screen
await page.getByPlaceholder(/GitHub — my-repo/).fill('CI notifications dark');
await page.locator('input[type=password]').fill('demo-secret');
await page.getByRole('button', { name: 'Create webhook' }).click();
await page.waitForTimeout(800);
await shot('3_success');
await page.getByRole('button', { name: 'Done' }).click();

// 4. Outgoing form
await page.getByRole('button', { name: 'New webhook' }).click();
await page.getByRole('button', { name: '↑ Send to another service', exact: false }).click();
await shot('4_outgoing_form');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {});

// 5. Logs modal on the GitHub webhook (has accepted + rejected entries)
await page.getByRole('button', { name: 'More actions' }).first().click();
await page.getByRole('menuitem', { name: 'Logs' }).click();
await shot('5_logs');
await page.keyboard.press('Escape');
await page.locator('button:has-text("✕"), [aria-label="Close"]').first().click().catch(() => {});

// 6. Variables panel (masked values)
await page.getByRole('button', { name: /Variables/ }).click();
await shot('6_variables');

// 7. Setup modal for an incoming webhook
await page.getByRole('button', { name: 'Setup' }).first().click();
await shot('7_setup_modal');

await browser.close();
