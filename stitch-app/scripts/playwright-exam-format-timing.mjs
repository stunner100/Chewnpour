import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'https://www.chewnpour.com';
const uploadFilePath =
  process.env.UPLOAD_FILE_PATH ||
  '/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright/smoke-topic.docx';
const maxTopicWaitMs = Number(process.env.MAX_TOPIC_WAIT_MS || 10 * 60 * 1000);
const maxEssayReadyWaitMs = Number(process.env.MAX_ESSAY_READY_WAIT_MS || 12 * 60 * 1000);
const maxExamReadyMs = Number(process.env.MAX_EXAM_READY_MS || 6 * 60 * 1000);
const headless =
  process.env.HEADLESS === undefined ? true : !['0', 'false'].includes(process.env.HEADLESS.toLowerCase());

const runId = `exam-format-timing-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const artifactsDir = `/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright/${runId}`;
await fs.mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForPath = async (pattern, timeout = 120000) => {
  const source = pattern.source;
  const flags = pattern.flags;
  await page.waitForFunction(
    ({ regexSource, regexFlags }) => {
      const regex = new RegExp(regexSource, regexFlags);
      return regex.test(window.location.pathname);
    },
    { regexSource: source, regexFlags: flags },
    { timeout }
  );
};

const screenshot = async (name) => {
  const file = path.join(artifactsDir, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, timeout: 8000 });
  } catch {
    // Keep timing run non-blocking even if screenshots fail.
  }
};

const resolveTopicFromCourse = async (courseUrl) => {
  const start = Date.now();
  await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await screenshot('course-initial');

  while (Date.now() - start < maxTopicWaitMs) {
    const topicLinks = page.locator('a[href*="/dashboard/topic/"]');
    const linkCount = await topicLinks.count();
    if (linkCount > 0) {
      const href = await topicLinks.first().getAttribute('href');
      if (href) {
        await page.goto(`${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`, {
          waitUntil: 'domcontentloaded',
          timeout: 120000,
        });
        await waitForPath(/\/dashboard\/topic\//, 20000);
        return {
          topicUrl: page.url(),
          waitSeconds: Math.round((Date.now() - start) / 1000),
          openMethod: 'topic-link',
        };
      }
    }

    const readyCard = page.locator('div.cursor-pointer:has-text("Read & Practice")').first();
    if (await readyCard.isVisible().catch(() => false)) {
      try {
        await readyCard.click({ timeout: 10000 });
        await waitForPath(/\/dashboard\/topic\//, 20000);
        return {
          topicUrl: page.url(),
          waitSeconds: Math.round((Date.now() - start) / 1000),
          openMethod: 'ready-card',
        };
      } catch {
        // Card could be visible before its click handler is active; keep polling.
      }
    }

    const topicLabel = page.getByText(/^Topic\s+\d+$/i).first();
    if (await topicLabel.isVisible().catch(() => false)) {
      try {
        await topicLabel.click({ timeout: 10000 });
        await waitForPath(/\/dashboard\/topic\//, 20000);
        return {
          topicUrl: page.url(),
          waitSeconds: Math.round((Date.now() - start) / 1000),
          openMethod: 'topic-label',
        };
      } catch {
        // Topic label exists on pending cards too; ignore and continue polling.
      }
    }

    await sleep(3000);
    if ((Date.now() - start) % 30000 < 3500) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    }
  }

  return null;
};

const waitUntilButtonEnabled = async (locator, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const visible = await locator.isVisible().catch(() => false);
    const enabled = visible && (await locator.isEnabled().catch(() => false));
    if (enabled) {
      return Math.round((Date.now() - start) / 1000);
    }
    await sleep(1500);
  }
  return null;
};

const waitForExamInteractive = async () => {
  const start = Date.now();
  while (Date.now() - start < maxExamReadyMs) {
    const submitVisible = await page.getByRole('button', { name: /submit exam/i }).isVisible().catch(() => false);
    if (submitVisible) {
      return { readySeconds: Math.round((Date.now() - start) / 1000), signal: 'submit-exam-visible' };
    }

    const nextVisible = await page.getByRole('button', { name: /^next$/i }).isVisible().catch(() => false);
    if (nextVisible) {
      return { readySeconds: Math.round((Date.now() - start) / 1000), signal: 'next-visible' };
    }

    const questionHeaderVisible = await page.getByText(/^Question\s+\d+/i).first().isVisible().catch(() => false);
    if (questionHeaderVisible) {
      return { readySeconds: Math.round((Date.now() - start) / 1000), signal: 'question-header-visible' };
    }

    const generateBtn = page.getByRole('button', { name: /generate questions/i });
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click().catch(() => {});
    }

    const retryBtn = page.getByRole('button', { name: /try again|retry/i });
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click().catch(() => {});
    }

    await sleep(2500);
  }
  return null;
};

const startAndMeasureExam = async (buttonLocator, examName) => {
  const start = Date.now();
  await buttonLocator.click({ timeout: 45000 });
  await waitForPath(/\/dashboard\/exam\//, 120000);
  const interactive = await waitForExamInteractive();
  if (!interactive) {
    throw new Error(`${examName} exam did not become interactive in time.`);
  }
  return {
    clickToInteractiveSeconds: interactive.readySeconds,
    signal: interactive.signal,
    navigationSeconds: Math.round((Date.now() - start) / 1000),
    examUrl: page.url(),
  };
};

const result = {
  runId,
  baseUrl,
  uploadFilePath,
  artifactsDir,
  status: 'failed',
  generatedAccount: null,
  metrics: {
    uploadToTopicReadySeconds: null,
    topicOpenMethod: null,
    mcqButtonReadySecondsAfterTopicOpen: null,
    essayButtonReadySecondsAfterTopicOpen: null,
    mcqClickToInteractiveSeconds: null,
    essayClickToInteractiveSeconds: null,
  },
  details: {},
  error: null,
};

try {
  // 1) Create fresh account and land on dashboard.
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('link', { name: /continue with email/i }).click();
  await page.waitForURL(/\/onboarding\/name/, { timeout: 45000 });

  const email = `qa_timing_${Date.now()}@example.com`;
  const password = 'TestPass123!';
  result.generatedAccount = { email, password };

  await page.getByPlaceholder('What should we call you?').fill('Timing QA');
  await page.getByPlaceholder('student@university.edu').fill(email);
  await page.getByPlaceholder('Create a strong password').fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.waitForURL(/\/onboarding\/level/, { timeout: 60000 });

  await page.getByRole('button', { name: /next/i }).first().click();
  await page.waitForURL(/\/onboarding\/department/, { timeout: 45000 });
  await page.getByText('Computer Science', { exact: true }).click();
  await page.getByRole('button', { name: /start learning/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  await screenshot('dashboard');

  // 2) Upload material and capture processing start.
  const uploadStart = Date.now();
  const fileInput = page.locator('input[type="file"][accept=".pdf,.pptx,.docx"]');
  await fileInput.setInputFiles(uploadFilePath);
  await page.waitForURL(/\/dashboard\/processing\//, { timeout: 120000 });
  await screenshot('processing');
  const processingUrl = page.url();
  const courseIdMatch = processingUrl.match(/\/dashboard\/processing\/([^/?#]+)/);
  const courseId = courseIdMatch?.[1];
  if (!courseId) {
    throw new Error(`Could not parse course ID from processing URL: ${processingUrl}`);
  }
  const courseUrl = `${baseUrl}/dashboard/course/${courseId}`;

  // 3) Wait for topic ready from generated course.
  const topicReady = await resolveTopicFromCourse(courseUrl);
  if (!topicReady?.topicUrl) {
    throw new Error('Timed out waiting for a ready topic after upload.');
  }
  result.metrics.uploadToTopicReadySeconds = Math.round((Date.now() - uploadStart) / 1000);
  result.metrics.topicOpenMethod = topicReady.openMethod;
  await screenshot('topic-ready');

  const topicUrl = topicReady.topicUrl;
  const topicOpenedAt = Date.now();

  // 4) Wait for MCQ and essay buttons readiness.
  const mcqBtn = page.getByRole('button', { name: /take mcq quiz|preparing quiz/i }).first();
  const essayBtn = page.getByRole('button', { name: /take essay quiz|essay preparing/i }).first();

  const mcqReadySeconds = await waitUntilButtonEnabled(mcqBtn, 180000);
  if (mcqReadySeconds === null) {
    throw new Error('MCQ button did not become enabled.');
  }
  result.metrics.mcqButtonReadySecondsAfterTopicOpen = mcqReadySeconds;

  let essayReadySeconds = await waitUntilButtonEnabled(essayBtn, maxEssayReadyWaitMs);
  if (essayReadySeconds === null) {
    // Refresh topic once before failing essay readiness to account for stale rendering.
    await page.goto(topicUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    essayReadySeconds = await waitUntilButtonEnabled(essayBtn, 120000);
  }
  if (essayReadySeconds === null) {
    throw new Error('Essay button did not become enabled within the allowed wait.');
  }
  result.metrics.essayButtonReadySecondsAfterTopicOpen = Math.round((Date.now() - topicOpenedAt) / 1000);

  // 5) Start MCQ and measure click -> interactive.
  const mcqStart = await startAndMeasureExam(mcqBtn, 'MCQ');
  result.metrics.mcqClickToInteractiveSeconds = mcqStart.clickToInteractiveSeconds;
  result.details.mcq = mcqStart;
  await screenshot('mcq-ready');

  // 6) Return to topic and start essay, then measure.
  await page.goto(topicUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitUntilButtonEnabled(essayBtn, 180000);
  const essayStart = await startAndMeasureExam(essayBtn, 'Essay');
  result.metrics.essayClickToInteractiveSeconds = essayStart.clickToInteractiveSeconds;
  result.details.essay = essayStart;
  await screenshot('essay-ready');

  result.status = 'passed';
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  await screenshot('failure');
} finally {
  const outPath = path.join(artifactsDir, 'exam-format-timing-report.json');
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
}
