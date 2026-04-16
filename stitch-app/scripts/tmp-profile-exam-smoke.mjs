import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.BASE_URL || 'https://www.chewnpour.com';
const password = process.env.ACCOUNT_PASSWORD || process.env.READY_PASSWORD || 'TestPass123!';
const emails = [
  'qa_exam_1771240578235@example.com',
  'qa_exam_1771236282457@example.com',
  'qa_exam_1771238780011@example.com',
  'qa_exam_1771341387610@example.com',
  'qa_exam_1771239524948@example.com',
];

const runId = `profile-exam-smoke-${Date.now()}`;
const artifactsDir = path.join('/Users/patrickannor/Desktop/stitch_onboarding_name/output/playwright', runId);
await fs.mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

const inspectRecentExams = async (page) => {
  return await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('h3')).find((el) => el.textContent?.trim() === 'Recent Exams');
    if (!heading) {
      return { found: false, error: 'Recent Exams heading missing' };
    }

    const sectionHeader = heading.parentElement;
    const listRoot = sectionHeader ? sectionHeader.nextElementSibling : null;
    if (!listRoot) {
      return { found: false, error: 'Recent Exams list container missing' };
    }

    const toggleButton = sectionHeader.querySelector('button') || null;
    const listContainer = listRoot.querySelector('.space-y-2');

    if (listContainer) {
      const rows = Array.from(listContainer.querySelectorAll(':scope > div')).filter(
        (row) => row.textContent && row.textContent.trim().length > 0
      );
      return {
        found: true,
        hasToggle: !!toggleButton,
        toggleText: toggleButton?.textContent?.trim() || null,
        rowsBefore: rows.length,
        rowsText: rows.map((row) => row.textContent?.trim().slice(0, 120)),
        hasNoAttemptsText: listRoot.textContent?.includes('No exam attempts yet') || false,
      };
    }

    const hasNoAttemptsText = listRoot.textContent?.includes('No exam attempts yet') || false;
    const fallbackRows = Array.from(listRoot.querySelectorAll('div')).filter(
      (row) => row.textContent && row.textContent.includes('%') && !row.textContent.includes('No exam attempts yet')
    );

    return {
      found: true,
      hasToggle: !!toggleButton,
      toggleText: toggleButton?.textContent?.trim() || null,
      rowsBefore: fallbackRows.length,
      rowsText: fallbackRows.map((row) => row.textContent?.trim().slice(0, 120)),
      hasNoAttemptsText,
    };
  });
};

for (const email of emails) {
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const result = { email, baseUrl };

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByPlaceholder('student@university.edu').fill(email);
    await page.getByPlaceholder('Enter your password').fill(password);
    await page.getByRole('button', { name: /log in|sign in/i }).click({ timeout: 12000 });

    await page.waitForURL(/\/(dashboard|onboarding\/name|onboarding\/department|onboarding\/level|profile)/, {
      timeout: 60000,
    });

    const pathname = new URL(page.url()).pathname;
    if (pathname.startsWith('/login')) {
      result.error = 'Login did not navigate off /login';
      results.push(result);
      await page.close();
      continue;
    }

    await page.goto(`${baseUrl}/profile`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactsDir, `${email}-profile.png`), fullPage: true });

    const pre = await inspectRecentExams(page);
    result.pre = pre;

    if (!pre.found) {
      result.error = pre.error || 'Recent Exams section not found';
      results.push(result);
      await page.close();
      continue;
    }

    if (pre.hasToggle) {
      const headerLocator = page.locator('h3', { hasText: 'Recent Exams' }).first().locator('..');
      const button = headerLocator.locator('button').first();
      const buttonText = await button.textContent().catch(() => '');
      result.toggleText = buttonText?.trim() || pre.toggleText;

      await button.click({ timeout: 5000 });
      await page.waitForTimeout(600);

      const post = await inspectRecentExams(page);
      result.post = post;
      await page.screenshot({ path: path.join(artifactsDir, `${email}-profile-post-toggle.png`), fullPage: true });
      result.viewAllFunctional = pre.rowsBefore !== post.rowsBefore ? 'rows-changed' : 'rows-unchanged';
    } else {
      result.viewAllFunctional = 'toggle-not-rendered';
    }

    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.ok = false;
  }

  results.push(result);
  await page.close();

  if (result.ok) {
    break;
  }
}

await browser.close();

const summary = {
  runId,
  baseUrl,
  totalAccountsTried: results.length,
  artifactsDir,
  results,
};

await fs.writeFile(path.join(artifactsDir, 'profile-exam-smoke-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
