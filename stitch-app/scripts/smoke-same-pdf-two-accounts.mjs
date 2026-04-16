import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'https://www.chewnpour.com';
const uploadFilePath = process.env.UPLOAD_FILE_PATH || '/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app/Channel Ideas Without Remotion.pdf';
const headless = process.env.HEADLESS === undefined ? true : !['0', 'false'].includes(String(process.env.HEADLESS).toLowerCase());
const timeoutMs = Number(process.env.TOPIC_WAIT_MS || 10 * 60 * 1000);

const runId = `same-pdf-two-users-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const artifactsDir = path.join('/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright', runId);
await fs.mkdir(artifactsDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForUploadInput = async (page, timeout = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    let handle;
    try {
      handle = await page.evaluateHandle(() => {
        const candidates = Array.from(document.querySelectorAll('input[type="file"]'));
        const preferred = candidates.find((input) => {
          const accept = String(input.getAttribute('accept') || '').toLowerCase();
          return accept.includes('.pdf') || accept.includes('.pptx') || accept.includes('.docx');
        });
        return preferred || candidates[0] || null;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Execution context was destroyed/i.test(message)) {
        await sleep(500);
        continue;
      }
      throw error;
    }
    const element = handle.asElement();
    if (element) {
      return element;
    }

    const uploadTriggerVisible = await page.getByRole('button', { name: /upload materials|add course/i }).first().isVisible().catch(() => false);
    if (uploadTriggerVisible) {
      await page.getByRole('button', { name: /upload materials|add course/i }).first().click({ timeout: 10000 }).catch(() => undefined);
    }
    await sleep(1000);
  }
  throw new Error('Timed out waiting for upload file input');
};

const takeShot = async (page, label) => {
  const shotPath = path.join(artifactsDir, `${label}.png`);
  try {
    await page.screenshot({ path: shotPath, fullPage: true, timeout: 15000 });
    return shotPath;
  } catch {
    return null;
  }
};

const parseTopicSummary = (text) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();

  const ofMatch = normalized.match(/(\d+)\s+of\s+(\d+)\s+topics?\s+ready/i);
  if (ofMatch) {
    return {
      generated: Number(ofMatch[1]),
      planned: Number(ofMatch[2]),
      source: 'x-of-y-topics-ready',
    };
  }

  const availableMatch = normalized.match(/(\d+)\s+topics?\s+available/i);
  if (availableMatch) {
    const count = Number(availableMatch[1]);
    return {
      generated: count,
      planned: count,
      source: 'topics-available',
    };
  }

  return null;
};

const waitForTopicSummary = async (page, userLabel) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await page.evaluate(() => document.body?.innerText || '');
    const parsed = parseTopicSummary(text);
    if (parsed && Number(parsed.planned) > 0) {
      return {
        ...parsed,
        elapsedSeconds: Math.round((Date.now() - started) / 1000),
      };
    }

    // If we got kicked to login due auth drift, fail clearly.
    if (/\/login(?:[/?#]|$)/i.test(new URL(page.url()).pathname)) {
      throw new Error(`[${userLabel}] redirected to login while waiting for topic summary`);
    }

    // Stay on the same course page and refresh periodically until summary settles.
    if (/\/dashboard\/course\//.test(new URL(page.url()).pathname)) {
      const elapsed = Date.now() - started;
      if (elapsed > 0 && elapsed % 30000 < 3000) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      }
    }

    await sleep(3000);
  }

  throw new Error(`[${userLabel}] timed out waiting for topic summary`);
};

const clickFirstVisible = async (page, selectors) => {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 10000 });
      return selector;
    }
  }
  throw new Error(`No visible selector matched: ${selectors.join(', ')}`);
};

const waitForFirstVisible = async (page, selectors, timeout = 120000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.isVisible().catch(() => false)) {
        return selector;
      }
    }
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for selectors: ${selectors.join(', ')}`);
};

const recoverSessionViaLogin = async (page, userIndex, email, password) => {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByPlaceholder('student@university.edu').fill(email, { timeout: 15000 });
  await page.getByPlaceholder('Enter your password').fill(password, { timeout: 15000 });
  await page.getByRole('button', { name: /log in|sign in/i }).click({ timeout: 15000 });
  await page.waitForURL(/\/(dashboard|onboarding\/(level|department))/, { timeout: 90000 });
  await takeShot(page, `u${userIndex}-03-recovery-login`);
};

const finishOnboardingToDashboard = async (page, userIndex, email, password) => {
  const started = Date.now();
  let loadingSince = null;
  let recoveryAttempted = false;

  while (Date.now() - started < 180000) {
    const pathname = new URL(page.url()).pathname;
    if (pathname.startsWith('/dashboard')) {
      return;
    }

    if (!pathname.startsWith('/onboarding')) {
      await sleep(1000);
      continue;
    }

    const hasLoadingShell = await page.getByText(/^Loading\.\.\.$/i).first().isVisible().catch(() => false);
    const hasOnboardingTitle = await page.locator('h1').first().isVisible().catch(() => false);

    if (hasLoadingShell && !hasOnboardingTitle) {
      if (!loadingSince) loadingSince = Date.now();
      if (!recoveryAttempted && Date.now() - loadingSince > 20000) {
        await recoverSessionViaLogin(page, userIndex, email, password);
        recoveryAttempted = true;
        loadingSince = null;
        continue;
      }
    } else {
      loadingSince = null;
    }

    // Prefer skip for resilience, then fall back to next/continue/start-learning.
    const skipClicked = await (async () => {
      const skipLocators = [
        page.getByText(/^skip$/i).first(),
        page.getByRole('button', { name: /^skip$/i }).first(),
        page.getByRole('link', { name: /^skip$/i }).first(),
      ];
      for (const locator of skipLocators) {
        if (await locator.isVisible().catch(() => false)) {
          await locator.click({ timeout: 10000 });
          await sleep(1200);
          return true;
        }
      }
      return false;
    })();

    if (skipClicked) continue;

    const clicked = await (async () => {
      const selectors = [
        'button.max-w-sm',
        'button.flex.w-full.max-w-sm',
        'button:has-text("Next")',
        'button:has-text("Continue")',
        'button:has-text("Start Learning")',
        'button:has-text("Finish")',
      ];
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if (await locator.isVisible().catch(() => false)) {
          await locator.click({ timeout: 10000 });
          await sleep(1200);
          return true;
        }
      }
      return false;
    })();

    if (clicked) continue;

    // Last resort: reload stalled onboarding route and retry.
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1200);
  }

  throw new Error(`[u${userIndex}] timed out while finishing onboarding flow`);
};

const onboardAndUpload = async (page, userIndex) => {
  const email = `qa_samepdf_${Date.now()}_${userIndex}@example.com`;
  const password = 'TestPass123!';

  await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('link', { name: /continue with email/i }).waitFor({ timeout: 120000 });
  await takeShot(page, `u${userIndex}-01-signup`);

  await page.getByRole('link', { name: /continue with email/i }).click({ timeout: 15000 });
  await page.waitForURL(/\/onboarding\/name/, { timeout: 45000 });

  await page.getByPlaceholder('What should we call you?').fill(`QA User ${userIndex}`);
  await page.getByPlaceholder('student@university.edu').fill(email);
  await page.getByPlaceholder('Create a strong password').fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click({ timeout: 15000 });

  await page.waitForURL(/\/onboarding\/(level|department)/, { timeout: 60000 });
  await takeShot(page, `u${userIndex}-02-onboarding-step`);
  await finishOnboardingToDashboard(page, userIndex, email, password);

  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  await takeShot(page, `u${userIndex}-04-dashboard`);

  const fileInput = await waitForUploadInput(page);
  await fileInput.setInputFiles(uploadFilePath, { timeout: 30000 });

  await page.waitForURL(/\/dashboard\/processing\//, { timeout: 120000 });
  const processingUrl = page.url();
  const match = processingUrl.match(/\/dashboard\/processing\/([^/?#]+)/);
  if (!match) {
    throw new Error(`[u${userIndex}] could not extract courseId from ${processingUrl}`);
  }
  const courseId = match[1];

  await takeShot(page, `u${userIndex}-05-processing`);
  // Allow normal processing flow (including client retry logic) to auto-route.
  try {
    await page.waitForURL(new RegExp(`/dashboard/course/${courseId}(?:[/?#]|$)`), {
      timeout: 180000,
    });
  } catch {
    await page.goto(`${baseUrl}/dashboard/course/${courseId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  await takeShot(page, `u${userIndex}-06-course-initial`);

  const summary = await waitForTopicSummary(page, `u${userIndex}`);
  await takeShot(page, `u${userIndex}-07-course-summary`);

  return {
    email,
    password,
    courseId,
    processingUrl,
    courseUrl: `${baseUrl}/dashboard/course/${courseId}`,
    ...summary,
  };
};

const browser = await chromium.launch({ headless });

const results = [];
let fatal = null;
for (let i = 1; i <= 2; i += 1) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    const result = await onboardAndUpload(page, i);
    results.push(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    fatal = { userIndex: i, message: msg, url: page.url() };
    try {
      await takeShot(page, `u${i}-99-failure`);
    } catch {}
    await context.close();
    break;
  }
  await context.close();
}

await browser.close();

const summary = {
  runId,
  baseUrl,
  uploadFilePath,
  artifactsDir,
  fatal,
  results,
  topicCountDelta: results.length === 2 ? Math.abs(Number(results[0].planned) - Number(results[1].planned)) : null,
  generatedDelta: results.length === 2 ? Math.abs(Number(results[0].generated) - Number(results[1].generated)) : null,
};

const outJson = path.join(artifactsDir, 'same-pdf-two-users-report.json');
await fs.writeFile(outJson, JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
