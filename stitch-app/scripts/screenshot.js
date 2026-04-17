import process from 'node:process';
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../public/screenshots');

const BASE = 'http://localhost:5173';

async function run() {
    const browser = await chromium.launch({ headless: true });

    // Wide 16:9 at 2x — for main hero shot
    const ctx16x9 = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
    });
    const page = await ctx16x9.newPage();

    await page.goto(BASE + '/signup', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, 'app-signup-hd.png') });
    console.log('✓ Signup HD');

    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outputDir, 'app-login-hd.png') });
    console.log('✓ Login HD');

    // Left panel close-up (just the branded half)
    await page.goto(BASE + '/signup', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({
        path: path.join(outputDir, 'app-panel.png'),
        clip: { x: 0, y: 0, width: 560, height: 900 },
    });
    console.log('✓ Panel crop');

    await ctx16x9.close();

    // Mobile viewport — shows onboarding nicely
    const ctxMobile = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
    });
    const mob = await ctxMobile.newPage();
    await mob.goto(BASE + '/signup', { waitUntil: 'networkidle', timeout: 15000 });
    await mob.waitForTimeout(2000);
    await mob.screenshot({ path: path.join(outputDir, 'app-mobile.png') });
    console.log('✓ Mobile signup');

    await ctxMobile.close();
    await browser.close();
    console.log('\nDone — screenshots in public/screenshots/');
}

run().catch((err) => { console.error(err); process.exit(1); });
