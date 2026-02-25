import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const runId = `authdiag-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const artifactsDir = `/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright/${runId}`;
await fs.mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

const consoleLogs = [];
const requestFails = [];
const responseErrors = [];

page.on('console', (msg) => {
  consoleLogs.push({ type: msg.type(), text: msg.text() });
});

page.on('requestfailed', (req) => {
  requestFails.push({
    url: req.url(),
    method: req.method(),
    failure: req.failure()?.errorText || 'unknown',
  });
});

page.on('response', async (resp) => {
  const status = resp.status();
  if (status >= 400) {
    let body = '';
    try {
      body = (await resp.text()).slice(0, 500);
    } catch {
      body = '<unavailable>';
    }
    responseErrors.push({
      url: resp.url(),
      status,
      body,
    });
  }
});

const screenshot = async (name) => {
  await page.screenshot({ path: path.join(artifactsDir, `${name}.png`), fullPage: true });
};

try {
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('link', { name: /continue with email/i }).click();
  await page.waitForURL(/\/onboarding\/name/, { timeout: 30000 });

  const email = `qa_diag_${Date.now()}@example.com`;
  await page.getByPlaceholder('What should we call you?').fill('Auth Diag');
  await page.getByPlaceholder('student@university.edu').fill(email);
  await page.getByPlaceholder('Create a strong password').fill('TestPass123!');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding\/level/, { timeout: 60000 });

  await page.waitForTimeout(20000);
  await screenshot('onboarding-level-stuck');

  const loadingVisible = await page.getByText(/^Loading\.\.\.$/).isVisible().catch(() => false);
  const nextVisible = await page.getByRole('button', { name: /^next$/i }).isVisible().catch(() => false);

  const report = {
    runId,
    finalUrl: page.url(),
    loadingVisible,
    nextVisible,
    consoleLogs,
    requestFails,
    responseErrors,
    artifactsDir,
  };

  await fs.writeFile(path.join(artifactsDir, 'auth-diagnostic.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
}
