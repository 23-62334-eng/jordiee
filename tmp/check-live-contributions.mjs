import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
try {
	const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
	await page.goto('http://127.0.0.1:5176/', { waitUntil: 'domcontentloaded' });
	const calendar = page.locator('figure').filter({ has: page.locator('figcaption') });
	await calendar.getByText(/Auto-syncs every minute/).waitFor({ timeout: 25000 });
	console.log('Live calendar:', await calendar.locator('figcaption').innerText());
	assert.match(await calendar.locator('figcaption').innerText(), /\d+ contributions in the last year on GitHub/);
	await calendar.scrollIntoViewIfNeeded();
	await calendar.screenshot({ path: 'tmp/contributions-live-desktop.png' });
	await page.setViewportSize({ width: 390, height: 844 });
	await calendar.screenshot({ path: 'tmp/contributions-live-mobile.png' });
	console.log('Desktop/mobile live calendar verified.');
} finally {
	await browser.close();
}
