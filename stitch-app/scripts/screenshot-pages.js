import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/screenshots');
const BASE = 'http://localhost:5175';

async function shot(page, url, filename) {
    await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outputDir, filename) });
    console.log(`✓ ${filename}`);
}

async function run() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await shot(page, '/__preview/dashboard', 'app-dashboard.png');
    await shot(page, '/__preview/assignment', 'app-assignment.png');
    await shot(page, '/__preview/community', 'app-community.png');

    await browser.close();
    console.log('\nAll done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
