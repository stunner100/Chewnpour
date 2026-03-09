import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'https://www.chewnpour.com';
const email = process.env.READY_EMAIL;
const password = process.env.READY_PASSWORD;
if (!email || !password) {
  throw new Error('READY_EMAIL and READY_PASSWORD are required.');
}

const runId = `concept-retake-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const artifactsDir = `/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright/${runId}`;
await fs.mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

const screenshot = async (name) => {
  const file = path.join(artifactsDir, `${name}.png`);
  try {
    await page.screenshot({ path: file, fullPage: true, timeout: 8000 });
  } catch {
    // Non-blocking in production smoke checks.
  }
  return file;
};

const waitForTopicPage = async () => {
  for (let i = 0; i < 12; i += 1) {
    const topicLinks = page.locator('a[href*="/dashboard/topic/"]');
    const count = await topicLinks.count();
    if (count > 0) {
      await topicLinks.first().click();
      await page.waitForURL(/\/dashboard\/topic\//, { timeout: 30000 });
      return true;
    }

    const readyCard = page.locator('div:has-text("Read & Practice")').first();
    if (await readyCard.isVisible().catch(() => false)) {
      await readyCard.click({ timeout: 10000 });
      await page.waitForURL(/\/dashboard\/topic\//, { timeout: 30000 });
      return true;
    }

    const topicLabel = page.getByText(/^Topic\\s+\\d+$/i).first();
    if (await topicLabel.isVisible().catch(() => false)) {
      await topicLabel.click({ timeout: 10000 });
      await page.waitForURL(/\/dashboard\/topic\//, { timeout: 30000 });
      return true;
    }

    await page.waitForTimeout(2000);
    if (i % 3 === 2) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    }
  }
  return false;
};

const waitForDashboardCourses = async () => {
  for (let i = 0; i < 20; i += 1) {
    const links = page.locator('a[href*="/dashboard/course/"]');
    const count = await links.count();
    if (count > 0) return count;

    const noCoursesVisible = await page.getByText(/no courses yet/i).isVisible().catch(() => false);
    if (noCoursesVisible) return 0;

    await page.waitForTimeout(2000);
    if (i % 5 === 4) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    }
  }
  return 0;
};

const absolutizeUrl = (href) => {
  if (!href) return '';
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
};

const openConceptBuilder = async () => {
  const studyConceptLink = page.getByRole('link', { name: /study concepts/i }).first();
  await studyConceptLink.waitFor({ timeout: 30000 });
  await studyConceptLink.click();
  await page.waitForURL(/\/dashboard\/concept-intro\//, { timeout: 30000 });

  const conceptCtaLink = page.locator('a[href*="/dashboard/concept/"]').first();
  await conceptCtaLink.waitFor({ timeout: 30000 });
  await conceptCtaLink.click({ force: true });
  await page.waitForURL(/\/dashboard\/concept\//, { timeout: 45000 });
};

const captureSignature = async () => {
  return page.evaluate(() => {
    const questionText = (document.querySelector('main h2')?.textContent || '').replace(/\s+/g, ' ').trim();
    const tokenTexts = Array.from(document.querySelectorAll('button[draggable="true"]'))
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .sort();
    const blanks = Array.from(document.querySelectorAll('main span'))
      .map((node) => (node.textContent || '').trim())
      .filter((text) => text === '___').length;

    const signature = JSON.stringify({
      questionText,
      tokenTexts,
      blanks,
    });

    return {
      questionText,
      tokenTexts,
      blanks,
      signature,
    };
  });
};

const waitForExerciseReady = async () => {
  let latest = await captureSignature();
  for (let i = 0; i < 45; i += 1) {
    if (latest.questionText && latest.blanks > 0) {
      return latest;
    }

    const tryAgain = page.getByRole('button', { name: /try again/i });
    const canRetry = await tryAgain.isVisible().catch(() => false);
    if (canRetry) {
      await tryAgain.click({ timeout: 10000 });
    }

    await page.waitForTimeout(1200);
    latest = await captureSignature();
  }
  return latest;
};

const completeExercise = async () => {
  const checkButton = page.getByRole('button', { name: /check answer/i });

  for (let i = 0; i < 40; i += 1) {
    if (await checkButton.isEnabled().catch(() => false)) {
      break;
    }
    const hasToken = (await page.locator('button[draggable="true"]').count()) > 0;
    if (!hasToken) break;
    await page.locator('button[draggable="true"]').first().click({ timeout: 5000 });
    await page.waitForTimeout(80);
  }

  await checkButton.click({ timeout: 10000 });
  await page.getByRole('button', { name: /new exercise/i }).waitFor({ timeout: 30000 });
};

const clickNewExerciseAndWait = async () => {
  await page.getByRole('button', { name: /new exercise/i }).click({ timeout: 10000 });
  return waitForExerciseReady();
};

const result = {
  runId,
  baseUrl,
  artifactsDir,
  rounds: [],
  duplicateDetected: false,
  duplicateQuestionTextDetected: false,
  notes: [],
};

try {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByPlaceholder('student@university.edu').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 120000 });
  await waitForDashboardCourses();
  await screenshot('01-dashboard');

  const courseLinks = page.locator('a[href*="/dashboard/course/"]');
  if ((await courseLinks.count()) === 0) {
    result.notes.push('No course links on dashboard; cannot run concept retake check.');
    throw new Error('No dashboard course links found.');
  }

  const courseHrefs = await courseLinks.evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href') || '')
      .filter((href) => href.includes('/dashboard/course/'))
  );
  let openedTopic = false;
  for (const [index, href] of courseHrefs.slice(0, 6).entries()) {
    await page.goto(absolutizeUrl(href), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForURL(/\/dashboard\/course\//, { timeout: 60000 });
    if (index === 0) {
      await screenshot('02-course');
    }
    openedTopic = await waitForTopicPage();
    if (openedTopic) break;
  }
  if (!openedTopic) {
    result.notes.push('Topic page not reachable from available course pages.');
    throw new Error('No topic link found after checking available courses.');
  }

  await screenshot('03-topic-detail');
  await openConceptBuilder();
  await waitForExerciseReady();
  await screenshot('04-concept-builder-initial');

  const seen = new Set();
  const seenQuestionTexts = new Set();

  const round1 = await captureSignature();
  result.rounds.push({ round: 1, ...round1 });
  seen.add(round1.signature);
  if (round1.questionText) {
    seenQuestionTexts.add(round1.questionText.toLowerCase().trim());
  }

  await completeExercise();
  const round2 = await clickNewExerciseAndWait();
  result.rounds.push({ round: 2, ...round2 });
  if (seen.has(round2.signature)) result.duplicateDetected = true;
  const round2QuestionKey = round2.questionText.toLowerCase().trim();
  if (seenQuestionTexts.has(round2QuestionKey)) result.duplicateQuestionTextDetected = true;
  seen.add(round2.signature);
  seenQuestionTexts.add(round2QuestionKey);
  await screenshot('05-round-2');

  await completeExercise();
  const round3 = await clickNewExerciseAndWait();
  result.rounds.push({ round: 3, ...round3 });
  if (seen.has(round3.signature)) result.duplicateDetected = true;
  const round3QuestionKey = round3.questionText.toLowerCase().trim();
  if (seenQuestionTexts.has(round3QuestionKey)) result.duplicateQuestionTextDetected = true;
  await screenshot('06-round-3');

  result.notes.push(
    result.duplicateDetected
      ? 'Duplicate concept exercise signature detected across retake rounds.'
      : 'No duplicate concept exercise signatures detected across 3 rounds.'
  );
  result.notes.push(
    result.duplicateQuestionTextDetected
      ? 'Duplicate concept question text detected across retake rounds.'
      : 'No duplicate concept question text detected across 3 rounds.'
  );
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  try {
    await screenshot('99-error');
  } catch {
    // ignore screenshot failure
  }
} finally {
  const outPath = path.join(artifactsDir, 'result.json');
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
}
