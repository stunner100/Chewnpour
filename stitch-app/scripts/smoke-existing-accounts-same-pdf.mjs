import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'https://www.chewnpour.com';
const uploadFilePath = process.env.UPLOAD_FILE_PATH || '/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app/Channel Ideas Without Remotion.pdf';
const password = process.env.ACCOUNT_PASSWORD || 'TestPass123!';
const timeoutMs = Number(process.env.TOPIC_WAIT_MS || 12 * 60 * 1000);
const headless = process.env.HEADLESS === undefined ? true : !['0', 'false'].includes(String(process.env.HEADLESS).toLowerCase());

const candidateEmails = [
  'qa_exam_1771240578235@example.com',
  'qa_exam_1771236282457@example.com',
  'qa_exam_1771238780011@example.com',
  'qa_exam_1771341387610@example.com',
  'qa_exam_1771239524948@example.com',
  'qa_exam_1771238777614@example.com',
  'qa_exam_1771836294090@example.com',
  'qa_exam_1771237960773@example.com',
  'qa_exam_1771239103044@example.com',
  'qa_exam_1771237514982@example.com',
  'qa_exam_1771238492035@example.com',
  'qa_exam_1771238296187@example.com',
  'qa_exam_1771239519484@example.com',
];

const runId = `existing-accounts-same-pdf-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const artifactsDir = path.join('/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright', runId);
await fs.mkdir(artifactsDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const waitForTopicSummary = async (page) => {
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
    if (/\/login(?:[/?#]|$)/i.test(new URL(page.url()).pathname)) {
      throw new Error('redirected to login while waiting for topic summary');
    }
    await sleep(3000);
    if ((Date.now() - started) % 30000 < 3000) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
    }
  }
  throw new Error('timed out waiting for topic summary > 0');
};

const waitForUploadOutcome = async (page) => {
  const started = Date.now();
  while (Date.now() - started < 120000) {
    const pathname = new URL(page.url()).pathname;
    const search = new URL(page.url()).search || '';
    if (/\/dashboard\/processing\//.test(pathname)) {
      const match = pathname.match(/\/dashboard\/processing\/([^/?#]+)/);
      return {
        status: 'processing_started',
        courseId: match?.[1] || null,
        url: page.url(),
      };
    }
    if (/\/subscription\/?$/.test(pathname) || /reason=upload_limit/.test(search)) {
      return {
        status: 'quota_blocked',
        url: page.url(),
      };
    }

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    if (/upload limit reached|top-up|quota/i.test(bodyText)) {
      return {
        status: 'quota_blocked',
        url: page.url(),
      };
    }

    await sleep(1500);
  }

  return {
    status: 'timeout',
    url: page.url(),
  };
};

const loginAndUpload = async (context, email) => {
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByPlaceholder('student@university.edu').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click({ timeout: 15000 });
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });

  const fileInput = page.locator('input[type="file"][accept=".pdf,.pptx,.docx"]').first();
  await fileInput.setInputFiles(uploadFilePath, { timeout: 30000 });

  const outcome = await waitForUploadOutcome(page);
  if (outcome.status !== 'processing_started' || !outcome.courseId) {
    return {
      email,
      outcome,
    };
  }

  const courseUrl = `${baseUrl}/dashboard/course/${outcome.courseId}`;
  await page.goto(courseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const summary = await waitForTopicSummary(page);

  return {
    email,
    outcome,
    courseId: outcome.courseId,
    courseUrl,
    ...summary,
  };
};

const browser = await chromium.launch({ headless });
const results = [];
const uploadReady = [];
let fatal = null;

for (const email of candidateEmails) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const result = await loginAndUpload(context, email);
    results.push(result);
    if (result.outcome?.status === 'processing_started' && Number(result.planned || 0) > 0) {
      uploadReady.push(result);
      if (uploadReady.length >= 2) {
        await context.close();
        break;
      }
    }
  } catch (error) {
    results.push({
      email,
      outcome: {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
  await context.close();
}

await browser.close();

if (uploadReady.length < 2) {
  fatal = {
    message: 'Could not find two existing accounts with successful upload + topic summary',
    uploadReadyCount: uploadReady.length,
  };
}

const summary = {
  runId,
  baseUrl,
  uploadFilePath,
  artifactsDir,
  fatal,
  uploadReady,
  results,
  topicCountDelta: uploadReady.length >= 2 ? Math.abs(Number(uploadReady[0].planned) - Number(uploadReady[1].planned)) : null,
  generatedDelta: uploadReady.length >= 2 ? Math.abs(Number(uploadReady[0].generated) - Number(uploadReady[1].generated)) : null,
};

await fs.writeFile(path.join(artifactsDir, 'existing-accounts-same-pdf-report.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
