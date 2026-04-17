import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit, devices } from 'playwright';
import { classifyPostSignupPath, extractCourseIdFromDashboardUrl } from './lib/playwrightExamFlowRouting.mjs';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const flowMode = (process.env.FLOW_MODE || 'upload').toLowerCase();
const outputDir = '/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright';
const uploadFilePath =
  process.env.UPLOAD_FILE_PATH ||
  '/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright/smoke-topic.docx';
const readyEmail = process.env.READY_EMAIL || '';
const readyPassword = process.env.READY_PASSWORD || '';
const readyCourseUrl = process.env.READY_COURSE_URL || '';
const readyCourseId = process.env.READY_COURSE_ID || '';
const maxTopicWaitMs = Number(process.env.MAX_TOPIC_WAIT_MS || 9 * 60 * 1000);
const topicDiagIntervalMs = Number(process.env.TOPIC_DIAG_INTERVAL_MS || 30_000);
const maxExamReadyMs = Number(process.env.MAX_EXAM_READY_MS || 5 * 60 * 1000);
const headless =
  process.env.HEADLESS === undefined ? true : !['0', 'false'].includes(process.env.HEADLESS.toLowerCase());
const requestedBrowserName = (process.env.BROWSER_NAME || 'chromium').toLowerCase();
const browserName = ['chromium', 'firefox', 'webkit'].includes(requestedBrowserName)
  ? requestedBrowserName
  : 'chromium';
const deviceProfile = process.env.DEVICE_PROFILE || '';
const networkProfile = (process.env.NETWORK_PROFILE || '').toLowerCase();
const transientOfflineBlipMs = Math.max(0, Number(process.env.TRANSIENT_OFFLINE_BLIP_MS || 0));
const transientOfflineBlipDelayMs = Math.max(0, Number(process.env.TRANSIENT_OFFLINE_BLIP_DELAY_MS || 0));
const topicExamCtaPattern = /take final exam|start final exam|take.*quiz|start topic quiz|start exam|retry exam/i;

const startedAt = Date.now();
const runEntropy = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const runId = `exam-${flowMode}-${new Date().toISOString().replace(/[:.]/g, '-')}-${runEntropy}`;
const artifactsDir = path.join(outputDir, runId);
const steps = [];
const notes = [];
const courseDomDiagnostics = [];

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForUploadInput = async () => {
  await page.waitForFunction(
    () => {
      const hasFileInput = Boolean(document.querySelector('input[type="file"]'));
      const hasUploadTrigger = Array.from(document.querySelectorAll('button, [role="button"], label')).some((node) =>
        /upload materials|add course/i.test((node.textContent || '').replace(/\s+/g, ' ').trim())
      );
      return hasFileInput || hasUploadTrigger;
    },
    undefined,
    { timeout: 120000 }
  );

  let fileInput = page.locator('input[type="file"]').first();
  const uploadTrigger = page.getByRole('button', { name: /upload materials|add course/i }).first();

  if ((await fileInput.count()) === 0) {
    const uploadTriggerVisible = await uploadTrigger.isVisible().catch(() => false);
    if (uploadTriggerVisible) {
      await uploadTrigger.click({ timeout: 10000 }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        appendNote(`Upload trigger click skipped: ${message}`);
      });
      fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 30000 });
    }
  }

  return fileInput;
};

const prepareTopicForExamStart = async () => {
  if (/\/dashboard\/exam\//.test(page.url())) {
    return { selectedStudyMode: null, autoNavigatedToExam: true };
  }

  await page
    .waitForFunction(
      () => {
        const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
        return (
          /\/dashboard\/exam\//.test(window.location.pathname) ||
          /practice only|quick revision|full lesson|exam prep|start exam|take final exam|retry exam/i.test(bodyText)
        );
      },
      undefined,
      { timeout: 30000 }
    )
    .catch(() => {});

  const practiceOnlyButton = page.getByRole('button', { name: /practice only/i }).first();
  const practiceOnlyVisible = await practiceOnlyButton.isVisible().catch(() => false);
  if (!practiceOnlyVisible) {
    return { selectedStudyMode: null, autoNavigatedToExam: false };
  }

  await screenshot('09-topic-study-mode');
  await practiceOnlyButton.click({ timeout: 30000 });
  appendNote('Selected Practice Only on study-mode chooser.');
  await sleep(2000);

  return {
    selectedStudyMode: 'practice-only',
    autoNavigatedToExam: /\/dashboard\/exam\//.test(page.url()),
  };
};

const waitForPath = async (page, pattern, timeout = 120000) => {
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
  return new URL(page.url()).pathname;
};

const absolutizeUrl = (href) => {
  if (!href) return null;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
};

const browserTypes = { chromium, firefox, webkit };
const browserType = browserTypes[browserName] || chromium;
const deviceDescriptor = deviceProfile ? devices[deviceProfile] : null;
if (deviceProfile && !deviceDescriptor) {
  throw new Error(`Unknown Playwright device profile: ${deviceProfile}`);
}

await fs.mkdir(artifactsDir, { recursive: true });

const browser = await browserType.launch({ headless });
const context = await browser.newContext(
  deviceDescriptor ? { ...deviceDescriptor } : { viewport: { width: 1440, height: 900 } }
);
const page = await context.newPage();

const applyNetworkProfile = async () => {
  if (!networkProfile) return;
  if (networkProfile !== 'slow3g') {
    appendNote(`Unknown NETWORK_PROFILE value "${networkProfile}". Supported: slow3g.`);
    return;
  }
  if (browserName !== 'chromium') {
    appendNote('NETWORK_PROFILE=slow3g is only supported on Chromium. Skipping emulation.');
    return;
  }

  const cdpSession = await context.newCDPSession(page);
  await cdpSession.send('Network.enable');
  await cdpSession.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 400,
    downloadThroughput: Math.round((50 * 1024) / 8),
    uploadThroughput: Math.round((20 * 1024) / 8),
    connectionType: 'cellular3g',
  });
  appendNote('Applied slow3g network emulation (Chromium CDP).');
};

if (requestedBrowserName !== browserName) {
  appendNote(`Unsupported BROWSER_NAME "${requestedBrowserName}". Falling back to "${browserName}".`);
}
await applyNetworkProfile();

const screenshot = async (label) => {
  const file = path.join(artifactsDir, `${label}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, timeout: 15000 });
    return file;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendNote(`Screenshot skipped (${label}): ${message}`);
    return null;
  }
};

const captureCourseDomSnapshot = async (reason, waitStartedAt) => {
  const snapshot = await page.evaluate(() => {
    const bodyText = document.body?.innerText || '';
    const compactBodyText = bodyText.replace(/\s+/g, ' ').trim();
    const main = document.querySelector('main');
    const mainText = (main?.innerText || '').replace(/\s+/g, ' ').trim();
    const links = Array.from(document.querySelectorAll('a[href]'));
    const topicLinks = links
      .map((link) => link.getAttribute('href'))
      .filter((href) => typeof href === 'string' && href.includes('/dashboard/topic/'));
    const courseLinks = links
      .map((link) => link.getAttribute('href'))
      .filter((href) => typeof href === 'string' && href.includes('/dashboard/course/'));
    const topicHeaders = Array.from(document.querySelectorAll('h3'))
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 8);
    const topicLabelMatches = bodyText.match(/\bTopic\s+\d+\b/gi) || [];
    const readyMatches = bodyText.match(/\bReady\b/g) || [];
    const generatingMatches = bodyText.match(/\bGenerating\b/gi) || [];
    const readPracticeMatches = bodyText.match(/Read\s*&\s*Practice/gi) || [];
    const loadingMatches =
      bodyText.match(/Loading\.\.\.|Creating Your Course|No topics yet|Preparing/gi) || [];

    return {
      url: window.location.href,
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() || null,
      topicLinks: topicLinks.slice(0, 10),
      topicLinkCount: topicLinks.length,
      courseLinkCount: courseLinks.length,
      topicHeaders,
      topicHeaderCount: topicHeaders.length,
      topicLabelCount: topicLabelMatches.length,
      readyCount: readyMatches.length,
      generatingCount: generatingMatches.length,
      readPracticeCount: readPracticeMatches.length,
      loadingSignalCount: loadingMatches.length,
      hasReadyToStudy: /Ready to Study/i.test(bodyText),
      hasNoTopicsYet: /No topics yet/i.test(bodyText),
      hasCreatingCourse: /Creating Your Course/i.test(bodyText),
      mainTextSnippet: mainText.slice(0, 380),
      bodyTextSnippet: compactBodyText.slice(0, 380),
    };
  });

  const elapsedMs = Date.now() - waitStartedAt;
  const entry = {
    at: new Date().toISOString(),
    reason,
    elapsedMs,
    ...snapshot,
  };
  courseDomDiagnostics.push(entry);

  appendNote(
    `[course-dom ${reason}] t=${Math.round(elapsedMs / 1000)}s url=${snapshot.url} h1="${
      snapshot.h1 || 'n/a'
    }" topicLinks=${snapshot.topicLinkCount} headers=${snapshot.topicHeaderCount} topicLabels=${snapshot.topicLabelCount} readyTokens=${snapshot.readyCount} generatingTokens=${snapshot.generatingCount} readPracticeTokens=${snapshot.readPracticeCount} loadingSignals=${snapshot.loadingSignalCount} readyToStudy=${snapshot.hasReadyToStudy} noTopicsYet=${snapshot.hasNoTopicsYet} creatingCourse=${snapshot.hasCreatingCourse}`
  );
};

const tryOpenTopicFromCoursePage = async () => {
  if (/\/dashboard\/topic\//.test(page.url())) {
    return { topicHref: new URL(page.url()).pathname, openMethod: 'already-on-topic' };
  }

  const topicLinks = page.locator('a[href*="/dashboard/topic/"]');
  const topicLinkCount = await topicLinks.count();
  if (topicLinkCount > 0) {
    const href = await topicLinks.first().getAttribute('href');
    if (href) {
      await page.goto(absolutizeUrl(href), { waitUntil: 'domcontentloaded', timeout: 120000 });
      await waitForPath(page, /\/dashboard\/topic\//, 15000);
      return { topicHref: new URL(page.url()).pathname, openMethod: 'topic-link' };
    }
  }

  const readyCard = page.locator('div.cursor-pointer:has-text("Read & Practice")').first();
  const readyCardVisible = await readyCard.isVisible().catch(() => false);
  if (readyCardVisible) {
    try {
      await readyCard.scrollIntoViewIfNeeded();
      await readyCard.click({ timeout: 10000 });
      await waitForPath(page, /\/dashboard\/topic\//, 15000);
      return { topicHref: new URL(page.url()).pathname, openMethod: 'ready-card-read-practice' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendNote(`Ready topic card click failed: ${message}`);
    }
  }

  const topicLabel = page.getByText(/^Topic\s+\d+$/i).first();
  const topicLabelVisible = await topicLabel.isVisible().catch(() => false);
  if (topicLabelVisible) {
    try {
      await topicLabel.click({ timeout: 10000 });
      await waitForPath(page, /\/dashboard\/topic\//, 15000);
      return { topicHref: new URL(page.url()).pathname, openMethod: 'topic-label' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendNote(`Topic label click failed: ${message}`);
    }
  }

  return null;
};

const waitForTopicReady = async () => {
  const probeIntervalMs = 3000;
  const reloadIntervalMs = 30000;
  const waitStart = Date.now();
  let lastReloadAt = Date.now();
  let nextDiagAt = waitStart + topicDiagIntervalMs;

  await captureCourseDomSnapshot('initial', waitStart);

  while (Date.now() - waitStart < maxTopicWaitMs) {
    if (/\/login(?:[/?#]|$)/i.test(page.url())) {
      throw new Error('Session redirected to login while waiting for topic readiness.');
    }

    const opened = await tryOpenTopicFromCoursePage();
    if (opened) {
      return {
        ...opened,
        waitSeconds: Math.round((Date.now() - waitStart) / 1000),
      };
    }

    if (Date.now() >= nextDiagAt) {
      await captureCourseDomSnapshot('30s-sample', waitStart);
      nextDiagAt += topicDiagIntervalMs;
    }

    await sleep(probeIntervalMs);

    if (Date.now() - lastReloadAt >= reloadIntervalMs) {
      await captureCourseDomSnapshot('before-reload', waitStart);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
      lastReloadAt = Date.now();
    }
  }

  await captureCourseDomSnapshot('timeout', waitStart);
  return null;
};

const completeOnboardingAndReachDashboard = async () => {
  recordStep('open-signup', 'started');
  await page.goto(`${baseUrl}/signup`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('link', { name: /continue with email/i }).waitFor({ timeout: 120000 });
  await screenshot('01-signup');
  recordStep('open-signup', 'passed', { url: page.url() });

  recordStep('open-email-onboarding', 'started');
  await page.getByRole('link', { name: /continue with email/i }).click({ timeout: 20000 });
  await page.waitForURL(/\/onboarding\/name/, { timeout: 30000 });
  await screenshot('02-onboarding-name');
  recordStep('open-email-onboarding', 'passed', { url: page.url() });

  const uniqueEmail = `qa_exam_${Date.now()}@example.com`;
  const password = 'TestPass123!';

  recordStep('create-account', 'started', { email: uniqueEmail });
  await page.getByPlaceholder('What should we call you?').fill('Playwright QA');
  await page.getByPlaceholder('student@university.edu').fill(uniqueEmail);
  await page.getByPlaceholder('Create a strong password').fill(password);
  await page.getByRole('button', { name: /^continue$/i }).click();
  const postSignupPath = await waitForPath(page, /\/(?:dashboard|onboarding\/level|onboarding\/department)(?:\/|$)/, 90000);
  const postSignupState = classifyPostSignupPath(postSignupPath);
  await screenshot('03-post-signup');
  recordStep('create-account', 'passed', { url: page.url(), postSignupState });

  if (postSignupState === 'level') {
    recordStep('complete-onboarding-level', 'started');
    await page.getByRole('button', { name: /next|continue/i }).first().click();
    await waitForPath(page, /\/(?:dashboard|onboarding\/department)(?:\/|$)/, 30000);
    await screenshot('04-onboarding-after-level');
    recordStep('complete-onboarding-level', 'passed', { url: page.url() });
  }

  const currentPath = classifyPostSignupPath(new URL(page.url()).pathname);
  if (currentPath === 'department') {
    recordStep('complete-onboarding-department', 'started');
    await page.getByText('Computer Science', { exact: true }).click();
    await page.getByRole('button', { name: /start learning|continue|finish/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
    await screenshot('05-dashboard');
    recordStep('complete-onboarding-department', 'passed', { url: page.url(), email: uniqueEmail, password });
  }

  return { email: uniqueEmail, password };
};

const loginWithReadyAccount = async () => {
  if (!readyEmail || !readyPassword) {
    throw new Error('READY_EMAIL and READY_PASSWORD are required for FLOW_MODE=ready.');
  }

  recordStep('login-existing-account', 'started', { email: readyEmail });
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByPlaceholder('student@university.edu').fill(readyEmail);
  await page.getByPlaceholder('Enter your password').fill(readyPassword);
  await page.getByRole('button', { name: /log in|sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  await screenshot('01-dashboard-after-login');
  recordStep('login-existing-account', 'passed', { url: page.url() });
};

const collectDashboardCourseDiscoveryState = async () => {
  return await page.evaluate(() => {
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    const courseLinks = Array.from(document.querySelectorAll('a[href*="/dashboard/course/"]'))
      .map((link) => link.getAttribute('href'))
      .filter((href) => typeof href === 'string' && href.includes('/dashboard/course/'));

    return {
      bodyText,
      courseLinks,
    };
  });
};

const waitForDashboardCourseDiscovery = async () => {
  const started = Date.now();
  let lastBodyText = '';

  while (Date.now() - started < 30000) {
    try {
      const snapshot = await collectDashboardCourseDiscoveryState();
      lastBodyText = snapshot.bodyText;

      const stillLoading = /Loading(?: your account)?(?:\.\.\.)?/i.test(snapshot.bodyText);
      const hasSettledDashboardSignals = /Your courses|No courses yet|Add Course|Upload Materials/i.test(snapshot.bodyText);

      if (snapshot.courseLinks.length > 0) {
        return snapshot;
      }

      if (!stillLoading && hasSettledDashboardSignals) {
        return snapshot;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Execution context was destroyed/i.test(message)) {
        appendNote(`Dashboard course discovery probe failed: ${message}`);
      }
    }

    await sleep(2000);
  }

  appendNote(`Dashboard course discovery timed out. Last body snapshot: ${(lastBodyText || '').slice(0, 200)}`);
  return {
    bodyText: lastBodyText,
    courseLinks: [],
  };
};

const discoverDashboardCourseUrls = async () => {
  const snapshot = await waitForDashboardCourseDiscovery();
  const hrefs = Array.isArray(snapshot?.courseLinks) ? snapshot.courseLinks : [];

  const normalized = [...new Set(hrefs.map((href) => href.trim()).filter(Boolean))]
    .map((href) => absolutizeUrl(href))
    .filter(Boolean);
  return normalized;
};

let summary = {
  runId,
  status: 'failed',
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: null,
  durationMs: 0,
  baseUrl,
  flowMode,
  browserName,
  requestedBrowserName,
  deviceProfile: deviceProfile || null,
  networkProfile: networkProfile || null,
  transientOfflineBlipMs,
  transientOfflineBlipDelayMs,
  headless,
  uploadFilePath,
  readyEmail: readyEmail || null,
  readyCourseUrl: readyCourseUrl || null,
  readyCourseId: readyCourseId || null,
  artifactsDir,
  steps,
  notes,
  courseDomDiagnostics,
  finalUrl: null,
  examResult: null,
};
appendNote(
  `Config: browser=${browserName} device=${deviceProfile || 'desktop-default'} network=${networkProfile || 'default'} offlineBlipMs=${transientOfflineBlipMs}`
);

try {
  if (flowMode === 'ready') {
    await loginWithReadyAccount();
  } else {
    await completeOnboardingAndReachDashboard();
  }

  recordStep('open-course-and-wait-for-topic', 'started', { flowMode });

  let candidateCourseUrls = [];
  if (readyCourseUrl) candidateCourseUrls.push(absolutizeUrl(readyCourseUrl));
  if (readyCourseId) candidateCourseUrls.push(`${baseUrl}/dashboard/course/${readyCourseId}`);
  if (!candidateCourseUrls.length) {
    candidateCourseUrls = await discoverDashboardCourseUrls();
  }
  candidateCourseUrls = [...new Set(candidateCourseUrls.filter(Boolean))];

  if (flowMode !== 'ready') {
    recordStep('upload-material', 'started');
    const fileInput = await waitForUploadInput();
    await fileInput.setInputFiles(uploadFilePath);
    await waitForPath(page, /\/dashboard\/(?:processing|course|topic)\//, 120000);
    await screenshot('06-processing-started');
    const processingUrl = page.url();
    const courseId = extractCourseIdFromDashboardUrl(processingUrl);
    if (!courseId) {
      throw new Error(`Could not extract courseId from processing URL: ${processingUrl}`);
    }
    candidateCourseUrls = [`${baseUrl}/dashboard/course/${courseId}`];
    recordStep('upload-material', 'passed', { processingUrl, courseId });
  }

  if (!candidateCourseUrls.length) {
    throw new Error('No course links found on dashboard for ready-course flow.');
  }

  appendNote(`Course candidates: ${candidateCourseUrls.join(', ')}`);

  let chosenCourseUrl = null;
  let topicWaitResult = null;
  for (let i = 0; i < candidateCourseUrls.length; i += 1) {
    const courseUrl = candidateCourseUrls[i];
    await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await screenshot(`07-course-${i + 1}-initial`);

    topicWaitResult = await waitForTopicReady();
    if (topicWaitResult?.topicHref) {
      chosenCourseUrl = courseUrl;
      break;
    }
  }

  if (!topicWaitResult?.topicHref) {
    await screenshot('08-course-timeout');
    throw new Error('Timed out waiting for a ready topic from selected course candidates.');
  }

  await screenshot('08-course-topic-ready');
  recordStep('open-course-and-wait-for-topic', 'passed', {
    chosenCourseUrl,
    waitSeconds: topicWaitResult.waitSeconds,
    topicHref: topicWaitResult.topicHref,
    openMethod: topicWaitResult.openMethod,
  });

  recordStep('open-topic', 'started');
  if (!/\/dashboard\/topic\//.test(page.url())) {
    const topicUrl = absolutizeUrl(topicWaitResult.topicHref);
    await page.goto(topicUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  }
  const topicExamPrep = await prepareTopicForExamStart();
  if (topicExamPrep.autoNavigatedToExam) {
    await screenshot('09-topic-detail');
    recordStep('open-topic', 'passed', {
      url: page.url(),
      topicExamCtaText: 'auto-navigated-to-exam',
      selectedStudyMode: topicExamPrep.selectedStudyMode,
    });
  }
  const topicExamCta = page.locator('a, button').filter({ hasText: topicExamCtaPattern }).first();
  if (!topicExamPrep.autoNavigatedToExam) {
    await topicExamCta.waitFor({ timeout: 120000 });
    await screenshot('09-topic-detail');
    const topicExamCtaText = ((await topicExamCta.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    recordStep('open-topic', 'passed', {
      url: page.url(),
      topicExamCtaText,
      selectedStudyMode: topicExamPrep.selectedStudyMode,
    });
  }

  recordStep('start-exam', 'started');
  if (!/\/dashboard\/exam\//.test(page.url())) {
    await topicExamCta.click({ timeout: 45000 });
    await waitForPath(page, /\/dashboard\/exam\//, 120000);
  }
  await screenshot('10-exam-opened');

  const examReadyStart = Date.now();
  let examReady = false;
  let examReadySignal = null;
  let transientOfflineApplied = false;

  while (Date.now() - examReadyStart < maxExamReadyMs) {
    if (
      !transientOfflineApplied &&
      transientOfflineBlipMs > 0 &&
      Date.now() - examReadyStart >= transientOfflineBlipDelayMs
    ) {
      transientOfflineApplied = true;
      appendNote(
        `Applying transient offline blip for ${transientOfflineBlipMs}ms after ${Math.round(
          (Date.now() - examReadyStart) / 1000
        )}s of exam wait.`
      );
      await context.setOffline(true);
      await sleep(transientOfflineBlipMs);
      await context.setOffline(false);
      appendNote('Transient offline blip finished; network restored.');
    }

    const submitExamVisible = await page.getByRole('button', { name: /submit exam/i }).isVisible().catch(() => false);
    if (submitExamVisible) {
      examReady = true;
      examReadySignal = 'submit-exam-visible';
      break;
    }

    const nextVisible = await page.getByRole('button', { name: /^next$/i }).isVisible().catch(() => false);
    if (nextVisible) {
      examReady = true;
      examReadySignal = 'next-visible';
      break;
    }

    const questionHeaderVisible = await page.getByText(/^Question\s+\d+/i).first().isVisible().catch(() => false);
    if (questionHeaderVisible) {
      examReady = true;
      examReadySignal = 'question-header-visible';
      break;
    }

    const generateBtn = page.getByRole('button', { name: /generate questions/i });
    const generateVisible = await generateBtn.isVisible().catch(() => false);
    if (generateVisible) {
      await generateBtn.click().catch(() => {});
    }

    const retryBtn = page.getByRole('button', { name: /try again|retry/i });
    const retryVisible = await retryBtn.isVisible().catch(() => false);
    if (retryVisible) {
      await retryBtn.click().catch(() => {});
    }

    const preparingVisible = await page
      .getByText(/preparing question bank|preparing your exam|generating/i)
      .first()
      .isVisible()
      .catch(() => false);

    appendNote(
      `Exam pending after ${Math.round((Date.now() - examReadyStart) / 1000)}s: generateVisible=${generateVisible}, retryVisible=${retryVisible}, preparingVisible=${preparingVisible}`
    );

    await sleep(5000);
  }

  if (!examReady) {
    await screenshot('11-exam-not-ready');
    throw new Error('Exam did not reach interactive state within timeout.');
  }

  await screenshot('11-exam-ready');
  recordStep('start-exam', 'passed', {
    readyInSeconds: Math.round((Date.now() - examReadyStart) / 1000),
    examReadySignal,
    url: page.url(),
  });

  summary.status = 'passed';
  summary.examResult = {
    examReadySignal,
  };
  summary.finalUrl = page.url();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  appendNote(`Failure: ${message}`);
  try {
    await screenshot('99-failure');
  } catch {
    // ignore screenshot failure
  }
  recordStep('run', 'failed', { message });
  summary.finalUrl = page.url();
} finally {
  await context.close();
  await browser.close();

  summary.finishedAt = new Date().toISOString();
  summary.durationMs = Date.now() - startedAt;

  const reportJsonPath = path.join(artifactsDir, 'exam-report.json');
  const reportMdPath = path.join(artifactsDir, 'exam-report.md');

  await fs.writeFile(reportJsonPath, JSON.stringify(summary, null, 2));

  const md = [
    `# Exam Flow Report (${runId})`,
    '',
    `- Status: ${summary.status.toUpperCase()}`,
    `- Mode: ${flowMode}`,
    `- Browser: ${browserName}`,
    `- Device Profile: ${deviceProfile || 'desktop-default'}`,
    `- Network Profile: ${networkProfile || 'default'}`,
    `- Offline Blip (ms): ${transientOfflineBlipMs}`,
    `- Started: ${summary.startedAt}`,
    `- Finished: ${summary.finishedAt}`,
    `- Duration (s): ${(summary.durationMs / 1000).toFixed(1)}`,
    `- Final URL: ${summary.finalUrl || 'n/a'}`,
    `- Artifacts: ${artifactsDir}`,
    '',
    '## Steps',
    ...steps.map((s, idx) => `${idx + 1}. ${s.name} - ${s.status}${s.details ? ` - ${JSON.stringify(s.details)}` : ''}`),
    '',
    '## Course DOM Diagnostics (30s)',
    ...(courseDomDiagnostics.length
      ? courseDomDiagnostics.map((item) =>
          `- ${item.at} [${item.reason}] t=${Math.round(item.elapsedMs / 1000)}s topicLinks=${item.topicLinkCount} headers=${item.topicHeaderCount} topicLabels=${item.topicLabelCount} readyTokens=${item.readyCount} generatingTokens=${item.generatingCount} readPractice=${item.readPracticeCount} h1="${item.h1 || 'n/a'}"`
        )
      : ['- none']),
    '',
    '## Notes',
    ...(notes.length ? notes.map((n) => `- ${n}`) : ['- none']),
    '',
  ].join('\n');

  await fs.writeFile(reportMdPath, md);

  console.log(
    JSON.stringify(
      {
        runId,
        status: summary.status,
        artifactsDir,
        reportJsonPath,
        reportMdPath,
        finalUrl: summary.finalUrl,
        durationMs: summary.durationMs,
      },
      null,
      2
    )
  );
}
