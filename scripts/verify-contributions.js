#!/usr/bin/env node
// Start Vite first: npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.CONTRIBUTIONS_TEST_URL || 'http://127.0.0.1:5176/';
const today = new Date().toISOString().slice(0, 10);
const previousYear = String(new Date().getUTCFullYear() - 1);
const dayMS = 86_400_000;
const recentDays = Array.from({ length: 8 }, (_, index) => ({
  date: new Date(Date.parse(`${today}T00:00:00Z`) - (7 - index) * dayMS).toISOString().slice(0, 10),
  count: index + 1,
  level: Math.min(4, index + 1),
}));
const payload = (extra = 0) => ({ contributions: recentDays.map((day, index) => ({
  ...day, count: day.count + (index === 7 ? extra : 0),
})) });
const snapshot = { generatedAt: `${today}T00:00:00Z`, days: recentDays.map((day) => ({ ...day, count: 1 })) };
const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
  .find((candidate) => candidate && existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
mkdirSync('tmp/contributions', { recursive: true });

async function scenario({ live = payload(), saved = snapshot, mobile = false } = {}, run) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const state = { live, saved, requests: [], snapshots: 0 };
  // Only the production minute interval is accelerated. Keep it paused until
  // the first render is asserted, then let native timer ticks drive refresh.
  await page.addInitScript(() => {
    const originalNow = Date.now.bind(Date);
    const interval = window.setInterval.bind(window);
    const clear = window.clearInterval.bind(window);
    let offset = 0;
    const active = new Set();
    window.__contributionClock = { running: false, hidden: false, active };
    Date.now = () => originalNow() + offset;
    Object.defineProperty(document, 'visibilityState', { configurable: true,
      get: () => window.__contributionClock.hidden ? 'hidden' : 'visible' });
    window.setInterval = (callback, delay, ...args) => {
      if (delay !== 60_000) return interval(callback, delay, ...args);
      const id = interval(() => {
        if (!window.__contributionClock.running) return;
        offset += 60_000;
        callback(...args);
      }, 100);
      active.add(id);
      return id;
    };
    window.clearInterval = (id) => { active.delete(id); clear(id); };
  });
  await page.route('**/api/contributions*', async (route) => {
    const request = route.request();
    const year = new URL(request.url()).searchParams.get('y');
    state.requests.push({ year, headers: request.headers() });
    const result = year === previousYear ? { contributions: [
      { date: `${previousYear}-01-01`, count: 4, level: 2 },
      { date: `${previousYear}-01-02`, count: 7, level: 4 },
    ] } : state.live;
    await route.fulfill(result === null ? { status: 503, body: 'Unavailable' } : { status: 200, json: result });
  });
  await page.route('**/contributions.json', (route) => {
    state.snapshots += 1;
    return route.fulfill(state.saved === null ? { status: 503, body: 'Unavailable' } : { status: 200, json: state.saved });
  });
  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Contribution Activity' }).scrollIntoViewIfNeeded();
    await run(page, state);
  } finally { await context.close(); }
}

async function caption(page, expected) {
  await page.getByRole('img', { name: expected, exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
}

async function ticking(page, enabled) {
  await page.evaluate((value) => { window.__contributionClock.running = value; }, enabled);
}

try {
  await scenario({}, async (page, state) => {
    await caption(page, '36 contributions in the last year');
    assert.equal(state.snapshots, 0, 'successful live load must not load the snapshot');
    assert.ok(state.requests.every((request) => request.year === 'last'));
    assert.ok(state.requests.every((request) => request.headers['cache-control'] === 'no-cache'));
    await page.getByText(/Auto-syncs every minute/).waitFor();
    state.live = payload(9);
    await ticking(page, true);
    await caption(page, '45 contributions in the last year');
    await ticking(page, false);
    await page.locator('figure').filter({ has: page.getByRole('img', { name: '45 contributions in the last year', exact: true }) }).screenshot({ path: 'tmp/contributions/desktop.png' });

    state.live = null;
    await ticking(page, true);
    await page.getByText(/Showing saved activity/).waitFor();
    await ticking(page, false);
    await caption(page, '45 contributions in the last year');
    assert.equal(state.snapshots, 0, 'failed refresh must preserve last live data');

    await page.getByRole('button', { name: previousYear, exact: true }).click();
    await caption(page, `11 contributions in ${previousYear}`);
    assert.equal(state.requests.at(-1).year, previousYear);
    assert.equal(await page.evaluate(() => window.__contributionClock.active.size), 1, 'year changes must clear the old refresh interval');

    const beforeHidden = state.requests.length;
    await page.evaluate(() => { window.__contributionClock.hidden = true; });
    await ticking(page, true);
    await page.waitForTimeout(350);
    await ticking(page, false);
    assert.equal(state.requests.length, beforeHidden, 'hidden tabs must not poll');
    await page.evaluate(() => { window.__contributionClock.hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('Auto-syncs'));
    await page.waitForTimeout(100);
    assert.ok(state.requests.length > beforeHidden, 'returning to a visible tab must refresh');
    console.log('PASS: live load, automatic refresh, retained live data, selected year, interval cleanup, hidden-tab pause/resume');
  });

  await scenario({ live: null, mobile: true }, async (page) => {
    await caption(page, '8 contributions in the last year');
    await page.getByText(/Showing saved activity from/).waitFor();
    await page.locator('figure').filter({ has: page.getByRole('img', { name: '8 contributions in the last year', exact: true }) }).screenshot({ path: 'tmp/contributions/mobile.png' });
    console.log('PASS: explicitly labelled saved snapshot, mobile calendar');
  });
  await scenario({ live: { contributions: recentDays.map((day) => ({ ...day, count: 0, level: 0 })) } }, async (page, state) => {
    await caption(page, 'No contributions in the last year');
    assert.equal(state.snapshots, 0);
    await page.getByText(/Auto-syncs every minute/).waitFor();
    console.log('PASS: a valid zero total is displayed without falling back');
  });
  await scenario({ live: null, saved: null }, async (page) => {
    await page.getByText(/GitHub activity is temporarily unavailable/).waitFor();
    await page.getByRole('link', { name: 'View on GitHub', exact: true }).waitFor();
    console.log('PASS: failure of both sources displays a recoverable error');
  });
  console.log('Contribution Activity browser checks passed. Screenshots: tmp/contributions/{desktop,mobile}.png');
} finally {
  await browser.close();
}
