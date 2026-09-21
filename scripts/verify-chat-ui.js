#!/usr/bin/env node
// Start Vite first: npm run dev -- --host 127.0.0.1 --port 5177 --strictPort
/**
 * Browser regression check for the chat panel's FAULT paths.
 *
 * The happy path is easy to try by hand and therefore gets tried. These do not:
 * they need the provider to be down, throttling, or cutting a stream off
 * mid-sentence — so in practice they are only ever exercised by a real visitor
 * on a bad day, which is the worst possible time to discover the panel hangs
 * with an empty bubble.
 *
 * Every response below is a shape api/chat.js genuinely produces. Each asserts
 * three things:
 *
 *   1. the text reaches the transcript at all;
 *   2. a degraded answer is LABELLED. The server prefers the owner's own FAQ
 *      text from profile.json over an apology, which is a real answer worth
 *      showing — but showing it unmarked would present canned words as the
 *      model's own, and the site should not become quietly less truthful the
 *      moment the provider wobbles;
 *   3. the composer is usable again afterwards. A panel that cannot be retried
 *      is indistinguishable from one that is still thinking.
 *
 * Intercepting at the network boundary rather than stubbing the component keeps
 * the SSE parser itself under test — the previous client read `data:` lines and
 * ignored `event:` names entirely, so the server's `error` frame (which carries
 * no text) silently did nothing and the bubble stayed empty forever.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const baseURL = process.env.CHAT_UI_TEST_URL || 'http://127.0.0.1:5177/';

const chrome = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser']
  .find((candidate) => candidate && existsSync(candidate));

const sse = (frames) =>
  frames.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');

const stream = (frames) => ({
  status: 200,
  contentType: 'text/event-stream',
  body: sse(frames),
});

const SCENARIOS = [
  {
    name: 'static-fallback',
    why: 'provider down, but profile.json answers this question — serve the owner\'s words, labelled',
    expectText: /internship/i,
    expectLabel: /saved answer/i,
    reply: stream([
      ['delta', { text: 'Yes — he is available for Internship / OJT.', degraded: true }],
      ['done', { degraded: true, source: 'static' }],
    ]),
  },
  {
    name: 'generic-fallback',
    why: 'provider down and nothing in the FAQ matches',
    expectText: /unavailable right now/i,
    expectLabel: /saved answer/i,
    reply: stream([
      ['delta', { text: 'The assistant is unavailable right now.', degraded: true }],
      ['done', { degraded: true, source: 'fallback' }],
    ]),
  },
  {
    name: 'mid-stream-truncation',
    why: 'fault after tokens were already shown — keep them, mark them cut off',
    expectText: /Mark is studying/i,
    expectLabel: /cut off/i,
    reply: stream([
      ['delta', { text: 'Mark is studying Information Tech' }],
      ['error', { truncated: true, degraded: true }],
      ['done', { degraded: true, source: 'truncated' }],
    ]),
  },
  {
    name: 'throttled-429-json',
    why: 'rate limit answers with JSON, not SSE — the client must not parse it as a stream',
    expectText: /lot of questions at once/i,
    expectLabel: /too many questions/i,
    reply: {
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: "That's a lot of questions at once. Please wait a moment and ask again.",
        degraded: true,
        source: 'throttled',
      }),
    },
  },
  {
    name: 'empty-stream',
    why: 'a stream that closes having said nothing must not leave an empty bubble',
    expectText: /did not send a reply/i,
    expectLabel: null,
    reply: stream([['done', { degraded: false }]]),
  },
];

const browser = await chromium.launch({ headless: true, ...(chrome ? { executablePath: chrome } : {}) });
let failures = 0;

for (const scenario of SCENARIOS) {
  const context = await browser.newContext({ viewport: { width: 900, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route('**/api/chat', (route) => route.fulfill(scenario.reply));

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Ask the assistant/i }).click();
  await page.getByLabel(/Ask a question/i).fill('Is Mark available for work?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(1200);

  const panel = await page.getByRole('dialog').innerText();
  const textOk = scenario.expectText.test(panel);
  const labelOk = scenario.expectLabel ? scenario.expectLabel.test(panel) : true;
  const recovers = await page.getByLabel(/Ask a question/i).isEnabled();

  const ok = textOk && labelOk && recovers;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${scenario.name.padEnd(22)} ` +
      `text:${textOk ? 'ok' : 'MISSING'} label:${labelOk ? 'ok' : 'MISSING'} ` +
      `recovers:${recovers ? 'yes' : 'STUCK'}`,
  );
  if (!ok) {
    console.log(`    expected: ${scenario.why}`);
    console.log(`    panel said: ${panel.replace(/\s+/g, ' ').slice(0, 220)}`);
  }
  await context.close();
}

/**
 * ── Layout: the chat controls must never collide with the bottom dock ───────
 *
 * NavBar renders a floating pill that is centre-anchored and, below `sm`, a
 * FIXED 280px wide regardless of viewport. The launcher is 56px at a 16px right
 * margin, so sitting beside it needs ~364px before any left margin — measured
 * pill-edge to button-edge it was -52px at 320, -17px at 390, and +3px at 430,
 * which is a coincidence rather than a gap. The launcher therefore stacks ABOVE
 * the dock on phones.
 *
 * Checked as rectangle intersection at real viewport sizes rather than by
 * reading the classes back, because the thing that breaks is the arithmetic
 * BETWEEN three independently-authored offsets — the dock's, the launcher's and
 * the panel's. Any one of them changing by a rem silently puts a control back
 * underneath another, and nothing in either component would say so.
 */
const VIEWPORTS = [
  ['narrow', 280, 653],
  ['iPhone SE', 320, 568],
  ['iPhone 12 mini', 360, 780],
  ['iPhone 14', 390, 844],
  ['14 Pro Max', 430, 932],
  ['sm edge', 639, 800],
  ['sm start', 640, 900],
  ['tablet', 834, 1000],
  ['desktop', 1280, 900],
];

const area = (a, b) => {
  if (!a || !b) return 0;
  const x = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  return x > 0 && y > 0 ? Math.round(x * y) : 0;
};

const measure = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    };
    const nav = document.querySelector('nav');
    // The <nav> itself is a full-width, pointer-events:none wrapper — measuring
    // it instead of the pill reports an overlap on every viewport including the
    // ones that are fine.
    const pill = nav?.querySelector('.glass-nav') ?? nav?.firstElementChild;
    const launcher = [...document.querySelectorAll('button')].find((b) =>
      /assistant/i.test(b.getAttribute('aria-label') ?? ''));
    return {
      pill: box(pill),
      launcher: box(launcher),
      panel: box(document.querySelector('[role="dialog"]')),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

let layoutFailures = 0;

for (const [label, width, height] of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const closed = await measure(page);
  await page.getByRole('button', { name: /Ask the assistant/i }).click();
  await page.waitForTimeout(500);
  const open = await measure(page);

  const problems = [];
  const collide = (a, b, name) => {
    const px = area(a, b);
    if (px > 0) problems.push(`${name} overlap ${px}px²`);
  };
  collide(closed.pill, closed.launcher, 'launcher/dock');
  collide(open.pill, open.launcher, 'launcher/dock (open)');
  collide(open.pill, open.panel, 'panel/dock');
  collide(open.launcher, open.panel, 'panel/launcher');
  if (open.panel && open.panel.y < 0) problems.push(`panel clipped off the top by ${Math.round(-open.panel.y)}px`);
  if (open.overflowX > 0) problems.push(`horizontal scroll ${open.overflowX}px`);

  if (problems.length) layoutFailures += 1;
  const gap = closed.pill && closed.launcher
    ? Math.round(closed.pill.y - closed.launcher.bottom)
    : null;
  console.log(
    `${problems.length ? '✗' : '✓'} ${label.padEnd(15)} ${String(width).padStart(4)}x${String(height).padEnd(4)} ` +
      `${gap !== null && gap >= 0 ? `stacked, ${gap}px above the dock` : 'side by side'}` +
      `${problems.length ? ` — ${problems.join(' · ')}` : ''}`,
  );
  await context.close();
}

await browser.close();
console.log(`\nchat UI fault paths — ${SCENARIOS.length - failures}/${SCENARIOS.length} correct`);
console.log(`chat UI layout     — ${VIEWPORTS.length - layoutFailures}/${VIEWPORTS.length} viewports clear of the dock`);
process.exit(failures + layoutFailures ? 1 : 0);
