import process from 'node:process';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5175';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);

    // Full page
    await page.screenshot({ path: path.resolve(__dirname, '../public/screenshots/landing-full.png'), fullPage: true });
    console.log('✓ Full page');

    await browser.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
