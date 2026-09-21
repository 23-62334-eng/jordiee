#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';

const URL = 'http://localhost:5175/';
(async () => {
  const outDir = path.join(process.cwd(), 'tmp', 'e2e');
  fs.mkdirSync(outDir, { recursive: true });

  // Launch Playwright Chromium with remote debugging port for Lighthouse.
  // Prefer a system-installed Chrome if available to avoid Playwright's bundled binary issues.
  const chromeCandidates = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].filter(Boolean);
  let browser;
  let launchedWith = 'playwright-bundled';
  for (const p of chromeCandidates) {
    try {
      if (p && fs.existsSync(p)) {
        browser = await chromium.launch({ headless: true, executablePath: p, args: ['--remote-debugging-port=9222', '--disable-gpu'] });
        launchedWith = p;
        break;
      }
    } catch (err) {
      console.warn('Failed to launch chrome at', p, err?.message || err);
      // try next
    }
  }
  if (!browser) {
    // Fallback to Playwright-managed browser
    browser = await chromium.launch({ headless: true, args: ['--remote-debugging-port=9222', '--disable-gpu'] });
  }
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('Launched browser with', launchedWith);

    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(outDir, 'closed.png'), fullPage: false });

    // Measure CLS via PerformanceObserver injection
    await page.evaluate(() => {
      window.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    // Open launcher
    await page.click('button[title="Open chat"]');
    await page.waitForTimeout(600); // allow animation
    await page.screenshot({ path: path.join(outDir, 'open.png') });

    // Click first suggested chip if present
    const chip = await page.$('div#chat-launcher button');
    if (chip) {
      await chip.click();
    }

    // After sending, there should be Loading… text
    await page.waitForSelector('text=Loading…', { timeout: 2000 }).catch(() => {});
    await page.screenshot({ path: path.join(outDir, 'loading.png') });

    // Wait a bit for response/fallback
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, 'response.png') });

    // Capture error state by aborting fetch? Instead, simulate network offline and send
    await context.setOffline(true);
    const input = await page.$('input[aria-label="Ask a question"]');
    if (input) await input.fill('Will this fail');
    const sendBtn = await page.$('button:has-text("Send")');
    if (sendBtn) await sendBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 'error.png') });
    await context.setOffline(false);

    // Axe-core accessibility check
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.3/axe.min.js' });
    const axeResults = await page.evaluate(async () => {
      return await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    });
    fs.writeFileSync(path.join(outDir, 'axe.json'), JSON.stringify(axeResults, null, 2));

    // Read CLS
    const cls = await page.evaluate(() => window.__cls || 0);
    fs.writeFileSync(path.join(outDir, 'cls.txt'), String(cls));

    // Save console messages
    fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(consoleMessages, null, 2));

    // Run Lighthouse (connect to the launched chromium)
    const lhFlags = { port: 9222, output: 'json', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
    const runnerResult = await lighthouse(URL, lhFlags);
    const lhScore = runnerResult.lhr.categories.performance.score * 100;
    fs.writeFileSync(path.join(outDir, 'lighthouse.json'), JSON.stringify(runnerResult.lhr, null, 2));
    console.log('Lighthouse performance score:', lhScore);

    // Output summary
    console.log('Screenshots and reports saved to', outDir);
    console.log('CLS measured:', cls);
    console.log('Axe violations:', axeResults.violations.length);
  } finally {
    await browser.close();
  }
})();
