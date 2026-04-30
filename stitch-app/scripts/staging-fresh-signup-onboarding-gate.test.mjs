import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = process.cwd();
const baseUrl = process.env.BASE_URL || 'https://staging.chewnpour.com';
const uploadFilePath =
  process.env.UPLOAD_FILE_PATH || '/tmp/chewnpour-staging-ui-e2e/photosynthesis-ui-e2e.docx';
const headless =
  process.env.HEADLESS === undefined
    ? true
    : !['0', 'false'].includes(String(process.env.HEADLESS).toLowerCase());

const dashboardSettleTimeoutMs = Number(process.env.DASHBOARD_SETTLE_TIMEOUT_MS || 90_000);
const uploadKickoffTimeoutMs = Number(process.env.UPLOAD_KICKOFF_TIMEOUT_MS || 120_000);
const uploadInputReadyTimeoutMs = Number(process.env.UPLOAD_INPUT_READY_TIMEOUT_MS || 120_000);
const dashboardResumeTimeoutMs = Number(process.env.DASHBOARD_RESUME_TIMEOUT_MS || 240_000);
const topicReadyTimeoutMs = Number(process.env.TOPIC_READY_TIMEOUT_MS || 240_000);
const examReadyTimeoutMs = Number(process.env.EXAM_READY_TIMEOUT_MS || 360_000);

const runId = `staging-onboarding-gate-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const artifactsDir = path.join(root, 'output', 'playwright', runId);
await fs.mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);

const steps = [];
const notes = [];

const recordStep = (name, status, details = {}) => {
  steps.push({
    name,
    status,
    at: new Date().toISOString(),
    details,
  });
};

const appendNote = (message) => {
  notes.push(`${new Date().toISOString()} ${message}`);
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const screenshot = async (label) => {
  const filePath = path.join(artifactsDir, `${label}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true, timeout: 15_000 });
    return filePath;
  } catch (error) {
    appendNote(`Screenshot skipped for ${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

const waitFor = async (label, callback, timeoutMs, intervalMs = 2_000) => {
  const startedAt = Date.now();
  let lastNote = '';

  while (Date.now() - startedAt < timeoutMs) {
    const result = await callback();
    if (result?.ok) {
      return {
        elapsedMs: Date.now() - startedAt,
        ...result,
      };
    }
    if (result?.note) {
      lastNote = result.note;
    }
    await sleep(intervalMs);
  }

  throw new Error(`Timed out waiting for ${label}. Last note: ${lastNote}`);
};

const extractCourseIdFromUrl = (url = '') => {
  const match = String(url || '').match(/\/dashboard\/(?:processing|course)\/([^/?#]+)/i);
  return match?.[1] || null;
};

const settleDashboard = async () =>
  await waitFor(
    'dashboard settle',
    async () => {
      const bodyText = await page.locator('body').innerText();
      return {
        ok: page.url().includes('/dashboard') && !/Loading your account/i.test(bodyText),
        note: `${page.url()} :: ${bodyText.slice(0, 180)}`,
      };
    },
    dashboardSettleTimeoutMs
  );

const clickFirstVisible = async (locators) => {
  for (const [label, locator] of locators) {
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 15_000 });
      return label;
    }
  }
  return null;
};

const finishOnboarding = async (email, password) => {
  const startedAt = Date.now();
  let loadingSince = null;
  let recoveryAttempted = false;

  while (Date.now() - startedAt < 180_000) {
    const pathname = new URL(page.url()).pathname;
    if (pathname.startsWith('/dashboard')) {
      return;
    }

    if (!pathname.startsWith('/onboarding')) {
      await sleep(1_000);
      continue;
    }

    const loadingShellVisible = await page
      .getByText(/^Loading your account\.\.\.$/i)
      .first()
      .isVisible()
      .catch(() => false);

    if (loadingShellVisible) {
      if (!loadingSince) loadingSince = Date.now();
      if (!recoveryAttempted && Date.now() - loadingSince > 20_000) {
        appendNote('Onboarding stalled on auth shell, attempting recovery login.');
        await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        await page.getByLabel(/email/i).fill(email);
        await page.locator('input[type="password"]').fill(password);
        await page.getByRole('button', { name: /^sign in$/i }).click();
        recoveryAttempted = true;
        loadingSince = null;
        continue;
      }
    } else {
      loadingSince = null;
    }

    if (/\/onboarding\/level(?:[/?#]|$)/i.test(pathname)) {
      const levelChoice = await clickFirstVisible([
        ['university', page.getByRole('button', { name: /university/i }).first()],
        ['continue', page.getByRole('button', { name: /next|continue/i }).first()],
        ['first-button', page.locator('button').nth(0)],
      ]);
      if (levelChoice) {
        appendNote(`Selected onboarding level via ${levelChoice}.`);
        await sleep(1_000);
        continue;
      }
    }

    if (/\/onboarding\/department(?:[/?#]|$)/i.test(pathname)) {
      const departmentInput = page.locator('input').first();
      if (await departmentInput.isVisible().catch(() => false)) {
        await departmentInput.fill('Biology');
      } else {
        const choiceClicked = await clickFirstVisible([
          ['computer-science', page.getByText('Computer Science', { exact: true }).first()],
          ['biology', page.getByText('Biology', { exact: true }).first()],
          ['first-option', page.locator('button').nth(0)],
        ]);
        if (choiceClicked) {
          appendNote(`Selected onboarding department via ${choiceClicked}.`);
        }
      }

      const submitClicked = await clickFirstVisible([
        ['start-learning', page.getByRole('button', { name: /start learning/i }).first()],
        ['continue', page.getByRole('button', { name: /continue|finish/i }).first()],
      ]);
      if (submitClicked) {
        appendNote(`Submitted onboarding department via ${submitClicked}.`);
        await sleep(1_000);
        continue;
      }
    }

    const skipClicked = await clickFirstVisible([
      ['skip-link', page.getByRole('link', { name: /^skip$/i }).first()],
      ['skip-button', page.getByRole('button', { name: /^skip$/i }).first()],
      ['skip-text', page.getByText(/^skip$/i).first()],
    ]);
    if (skipClicked) {
      appendNote(`Advanced onboarding via ${skipClicked}.`);
      await sleep(1_000);
      continue;
    }

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await sleep(1_000);
  }

  throw new Error('Timed out while completing onboarding.');
};

const waitForUploadRoute = async () =>
  await waitFor(
    'upload kickoff route',
    async () => {
      const currentUrl = page.url();
      const bodyText = await page.locator('body').innerText();
      const courseId = extractCourseIdFromUrl(currentUrl);
      return {
        ok:
          /\/dashboard\/(?:processing|course)\//i.test(currentUrl) ||
          Boolean(courseId) ||
          /creating your course|processing/i.test(bodyText),
        note: `${currentUrl} :: ${bodyText.slice(0, 220)}`,
        courseId,
      };
    },
    uploadKickoffTimeoutMs
  );

const waitForUploadInput = async () =>
  await waitFor(
    'dashboard upload input',
    async () => {
      const pathname = new URL(page.url()).pathname;
      const fileInput = page.locator('input[type="file"]').first();
      const exists = (await fileInput.count()) > 0;
      const bodyText = await page.locator('body').innerText();

      return {
        ok: pathname.startsWith('/dashboard') && exists,
        note: `${pathname} :: ${bodyText.slice(0, 220)}`,
      };
    },
    uploadInputReadyTimeoutMs,
    1_500
  );

const waitForDashboardCourseEntry = async (courseId) => {
  const exactHref = courseId ? `/dashboard/course/${courseId}` : null;
  const startedAt = Date.now();
  let lastSummary = '';
  let reloadCount = 0;

  while (Date.now() - startedAt < dashboardResumeTimeoutMs) {
    if (!page.url().includes('/dashboard')) {
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    }

    const bodyText = await page.locator('body').innerText();
    if (/Loading your account/i.test(bodyText)) {
      await sleep(2_000);
      continue;
    }

    const linkSnapshot = await page.locator('a[href*="/dashboard/course/"]').evaluateAll((els) =>
      els.map((el) => ({
        href: el.getAttribute('href'),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      }))
    );

    const normalizedLinks = linkSnapshot.filter((entry) => entry.href);
    lastSummary = normalizedLinks
      .slice(0, 6)
      .map((entry) => `${entry.text || '(no text)'} -> ${entry.href}`)
      .join(' | ');

    const targetLinks = normalizedLinks.filter((entry) =>
      exactHref ? entry.href === exactHref : entry.href.includes('/dashboard/course/')
    );

    if (targetLinks.length > 0) {
      const preferred = targetLinks.find((entry) => /resume/i.test(entry.text))
        || targetLinks.find((entry) => /continue/i.test(entry.text))
        || targetLinks[0];

      const targetLocator = exactHref
        ? page.locator(`a[href="${preferred.href}"]`).filter({ hasText: preferred.text || /./ }).first()
        : page.locator(`a[href="${preferred.href}"]`).first();

      if (await targetLocator.isVisible().catch(() => false)) {
        await targetLocator.click({ timeout: 15_000 });
        await waitFor(
          'course route after dashboard resume',
          async () => ({
            ok: /\/dashboard\/course\//i.test(page.url()),
            note: page.url(),
          }),
          60_000,
          1_500
        );

        return {
          ok: true,
          entryText: preferred.text,
          entryHref: preferred.href,
          entryKind: /resume/i.test(preferred.text)
            ? 'resume'
            : /continue/i.test(preferred.text)
              ? 'continue'
              : 'course-link',
        };
      }
    }

    await sleep(3_000);
    if (Date.now() - startedAt >= (reloadCount + 1) * 30_000) {
      reloadCount += 1;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    }
  }

  throw new Error(`Timed out waiting for dashboard Resume/Continue course entry. Last links: ${lastSummary}`);
};

const waitForTopicLink = async () => {
  const startedAt = Date.now();
  let reloadCount = 0;
  while (Date.now() - startedAt < topicReadyTimeoutMs) {
    const topicLink = page.locator('a[href*="/dashboard/topic/"]').first();
    if (await topicLink.isVisible().catch(() => false)) {
      return topicLink;
    }

    const bodyText = await page.locator('body').innerText();
    if (/\/login(?:[/?#]|$)/i.test(new URL(page.url()).pathname)) {
      throw new Error('Redirected to login while waiting for a topic link.');
    }

    appendNote(`Waiting for topic link: ${bodyText.slice(0, 180)}`);
    await sleep(3_000);
    if (Date.now() - startedAt >= (reloadCount + 1) * 30_000) {
      reloadCount += 1;
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 90_000 });
    }
  }

  throw new Error('Timed out waiting for a topic link on the course page.');
};

const waitForExamQuestion = async () =>
  await waitFor(
    'exam question render',
    async () => {
      const bodyText = await page.locator('body').innerText();
      if (/Exam Preparation Failed|Connection dropped while starting the exam|Unable to start the exam/i.test(bodyText)) {
        const retryButton = page.getByRole('button', { name: /retry/i }).first();
        if (await retryButton.isVisible().catch(() => false)) {
          appendNote('Exam fallback appeared; tapping Retry and continuing to wait.');
          await retryButton.click({ timeout: 15_000 }).catch(() => null);
          await sleep(1_500);
        }
        return {
          ok: false,
          note: `Exam fallback visible: ${bodyText.slice(0, 220)}`,
        };
      }
      return {
        ok: /Question\s+1|Which statement is directly supported by Evidence 1|What does the evidence state/i.test(
          bodyText
        ),
        note: bodyText.slice(0, 220),
        preview: bodyText.slice(0, 1_200),
      };
    },
    examReadyTimeoutMs
  );

const startedAt = Date.now();
const uniqueEmail = `gate_${Date.now()}@example.com`;
const password = 'TestPass123!';

let summary = {
  runId,
  status: 'failed',
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: null,
  durationMs: 0,
  baseUrl,
  uploadFilePath,
  artifactsDir,
  email: uniqueEmail,
  steps,
  notes,
  courseId: null,
  topicId: null,
  dashboardEntry: null,
  finalUrl: null,
  examPreview: null,
  error: null,
};

try {
  recordStep('open-signup', 'started');
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByRole('link', { name: /continue with email/i }).waitFor({ timeout: 120_000 });
  await screenshot('01-signup');
  recordStep('open-signup', 'passed', { url: page.url() });

  recordStep('open-email-signup', 'started');
  await page.getByRole('link', { name: /continue with email/i }).click({ timeout: 20_000 });
  await page.waitForURL(/\/onboarding\/name/, { timeout: 45_000 });
  await screenshot('02-onboarding-name');
  recordStep('open-email-signup', 'passed', { url: page.url() });

  recordStep('create-account', 'started', { email: uniqueEmail });
  await page.getByPlaceholder('What should we call you?').fill('Playwright Gate');
  await page.getByPlaceholder('student@university.edu').fill(uniqueEmail);
  await page.getByPlaceholder('Create a strong password').fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  const postSignupRoute = await waitFor(
    'post-signup route advance',
    async () => {
      const pathname = new URL(page.url()).pathname;
      const bodyText = await page.locator('body').innerText();
      return {
        ok:
          /\/dashboard(?:[/?#]|$)/i.test(pathname)
          || /\/onboarding\/level(?:[/?#]|$)/i.test(pathname)
          || /\/onboarding\/department(?:[/?#]|$)/i.test(pathname),
        note: `${pathname} :: ${bodyText.slice(0, 200)}`,
      };
    },
    90_000,
    1_500
  );
  await screenshot('03-post-create-submit');
  recordStep('create-account', 'passed', {
    url: page.url(),
    email: uniqueEmail,
    elapsedMs: postSignupRoute.elapsedMs,
  });

  recordStep('complete-onboarding', 'started');
  await finishOnboarding(uniqueEmail, password);
  await settleDashboard();
  await screenshot('04-dashboard-ready');
  recordStep('complete-onboarding', 'passed', { url: page.url() });

  recordStep('upload-document', 'started');
  await waitForUploadInput();
  await page.locator('input[type="file"]').first().setInputFiles(uploadFilePath);
  const uploadRoute = await waitForUploadRoute();
  const courseId = uploadRoute.courseId || extractCourseIdFromUrl(page.url());
  if (!courseId) {
    throw new Error(`Could not determine course ID after upload kickoff from ${page.url()}`);
  }
  summary.courseId = courseId;
  await screenshot('05-upload-kickoff');
  recordStep('upload-document', 'passed', { url: page.url(), courseId });

  recordStep('follow-dashboard-resume-path', 'started', { courseId });
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await settleDashboard();
  const dashboardEntry = await waitForDashboardCourseEntry(courseId);
  summary.dashboardEntry = dashboardEntry;
  await screenshot('06-dashboard-course-entry');
  recordStep('follow-dashboard-resume-path', 'passed', dashboardEntry);

  recordStep('open-topic', 'started');
  const topicLink = await waitForTopicLink();
  const topicHref = await topicLink.getAttribute('href');
  await topicLink.click({ timeout: 15_000 });
  await waitFor(
    'topic route',
    async () => ({
      ok: /\/dashboard\/topic\//i.test(page.url()),
      note: page.url(),
    }),
    60_000,
    1_500
  );
  const topicId = new URL(page.url()).pathname.split('/').pop();
  summary.topicId = topicId;
  await screenshot('07-topic-ready');
  recordStep('open-topic', 'passed', { topicHref, topicId, url: page.url() });

  recordStep('open-exam', 'started');
  await page.goto(`${baseUrl}/dashboard/exam/${topicId}?autostart=mcq`, {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });
  await screenshot('08-exam-loader');
  const examQuestion = await waitForExamQuestion();
  summary.examPreview = examQuestion.preview;
  await screenshot('09-exam-question');
  recordStep('open-exam', 'passed', { url: page.url() });

  summary.status = 'passed';
  summary.finalUrl = page.url();
} catch (error) {
  summary.error = error instanceof Error ? error.message : String(error);
  summary.finalUrl = page.url();
  appendNote(`Failure: ${summary.error}`);
  await screenshot('99-failure');
} finally {
  await context.close();
  await browser.close();
  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Date.now() - startedAt;

  const reportPath = path.join(artifactsDir, 'staging-fresh-signup-onboarding-gate-report.json');
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (summary.status !== 'passed') {
    process.exitCode = 1;
  }
}
