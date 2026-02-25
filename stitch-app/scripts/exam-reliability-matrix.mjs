import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const flowScriptPath = path.join(root, 'scripts', 'playwright-exam-flow.mjs');
const outputRoot = path.join(root, 'output', 'playwright');
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173';
const defaultHeadless = process.env.HEADLESS ?? '1';
const defaultMaxTopicWaitMs = Number(process.env.MAX_TOPIC_WAIT_MS || 6 * 60 * 1000);
const defaultMaxExamReadyMs = Number(process.env.MAX_EXAM_READY_MS || 3 * 60 * 1000);
const runLoadConcurrency = ['1', 'true', 'yes'].includes(
  String(process.env.RUN_LOAD || '').toLowerCase()
);
const loadWorkers = Math.max(2, Number(process.env.LOAD_WORKERS || 3));
const bootstrapMaxAttempts = Math.max(1, Number(process.env.BOOTSTRAP_MAX_ATTEMPTS || 2));

const matrixStartedAtMs = Date.now();
const matrixRunId = `exam-matrix-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const matrixArtifactsDir = path.join(outputRoot, matrixRunId);

const parseLastJsonObject = (text) => {
  const value = String(text || '').trim();
  if (!value) return null;

  for (let index = value.lastIndexOf('{'); index >= 0; index = value.lastIndexOf('{', index - 1)) {
    const candidate = value.slice(index);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Keep scanning until we find a valid trailing JSON object.
    }
  }
  return null;
};

const runFlow = ({ name, envOverrides = {}, timeoutMs = 15 * 60 * 1000 }) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const env = {
      ...process.env,
      BASE_URL: baseUrl,
      HEADLESS: defaultHeadless,
      MAX_TOPIC_WAIT_MS: String(defaultMaxTopicWaitMs),
      MAX_EXAM_READY_MS: String(defaultMaxExamReadyMs),
      ...envOverrides,
    };
    const child = spawn(process.execPath, [flowScriptPath], {
      cwd: root,
      env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const parsedSummary = parseLastJsonObject(stdout);
      const combinedOutput = `${stdout}\n${stderr}`;
      const missingBrowserBinary = /Executable doesn't exist|download new browsers|playwright install/i.test(
        combinedOutput
      );
      const status = parsedSummary?.status
        || (missingBrowserBinary ? 'skipped' : timedOut ? 'timeout' : code === 0 ? 'unknown' : 'failed');
      resolve({
        name,
        status,
        skipReason: missingBrowserBinary ? 'browser_not_installed' : null,
        exitCode: code,
        signal,
        timedOut,
        durationMs: Date.now() - startedAt,
        summary: parsedSummary,
        stdout,
        stderr,
      });
    });
  });

const readFlowReport = async (reportPath) => {
  if (!reportPath) return null;
  const source = await fs.readFile(reportPath, 'utf8');
  return JSON.parse(source);
};

const extractBootstrapContext = (report) => {
  const onboardingStep = report?.steps?.find(
    (step) => step.name === 'complete-onboarding-department' && step.status === 'passed'
  );
  const uploadStep = report?.steps?.find(
    (step) => step.name === 'upload-material' && step.status === 'passed'
  );
  const openCourseStep = report?.steps?.find(
    (step) => step.name === 'open-course-and-wait-for-topic' && step.status === 'passed'
  );

  const readyEmail = onboardingStep?.details?.email || '';
  const readyPassword = onboardingStep?.details?.password || '';
  const readyCourseId = uploadStep?.details?.courseId || '';
  const readyTopicHref = openCourseStep?.details?.topicHref || '';

  if (!readyEmail || !readyPassword || !readyCourseId) {
    throw new Error(
      'Bootstrap upload run did not produce login credentials or courseId for follow-up ready-mode scenarios.'
    );
  }

  return { readyEmail, readyPassword, readyCourseId, readyTopicHref };
};

await fs.mkdir(matrixArtifactsDir, { recursive: true });

const scenarioResults = [];
const addScenario = async (scenario) => {
  const result = await runFlow(scenario);
  scenarioResults.push({
    name: result.name,
    status: result.status,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    exitCode: result.exitCode,
    signal: result.signal,
    skipReason: result.skipReason || null,
    runId: result.summary?.runId || null,
    artifactsDir: result.summary?.artifactsDir || null,
    reportJsonPath: result.summary?.reportJsonPath || null,
    reportMdPath: result.summary?.reportMdPath || null,
    finalUrl: result.summary?.finalUrl || null,
    stderr: result.stderr || '',
    stdout: result.stdout || '',
  });
  return result;
};

let bootstrap = null;
for (let attempt = 1; attempt <= bootstrapMaxAttempts; attempt += 1) {
  bootstrap = await addScenario({
    name: attempt === 1 ? 'new-user-upload-chromium' : `new-user-upload-chromium-retry-${attempt - 1}`,
    envOverrides: {
      FLOW_MODE: 'upload',
      BROWSER_NAME: 'chromium',
    },
  });
  if (bootstrap.status === 'passed') {
    break;
  }
}

if (bootstrap.status !== 'passed') {
  const failure = {
    runId: matrixRunId,
    status: 'failed',
    startedAt: new Date(matrixStartedAtMs).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - matrixStartedAtMs,
    baseUrl,
    matrixArtifactsDir,
    reason: 'bootstrap_failed',
    scenarioResults,
  };
  const reportJsonPath = path.join(matrixArtifactsDir, 'exam-matrix-report.json');
  await fs.writeFile(reportJsonPath, JSON.stringify(failure, null, 2));
  console.log(
    JSON.stringify(
      {
        runId: matrixRunId,
        status: 'failed',
        reason: 'bootstrap_failed',
        reportJsonPath,
      },
      null,
      2
    )
  );
  process.exit(1);
}

const bootstrapReport = await readFlowReport(bootstrap.summary?.reportJsonPath);
const bootstrapContext = extractBootstrapContext(bootstrapReport);
const readyBaseEnv = {
  FLOW_MODE: 'ready',
  READY_EMAIL: bootstrapContext.readyEmail,
  READY_PASSWORD: bootstrapContext.readyPassword,
  READY_COURSE_ID: bootstrapContext.readyCourseId,
};

const readyScenarios = [
  {
    name: 'existing-user-ready-chromium',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'chromium',
    },
  },
  {
    name: 'existing-user-repeat-attempt-1',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'chromium',
    },
  },
  {
    name: 'existing-user-repeat-attempt-2',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'chromium',
    },
  },
  {
    name: 'existing-user-ready-firefox',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'firefox',
    },
  },
  {
    name: 'existing-user-ready-webkit-iphone13',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'webkit',
      DEVICE_PROFILE: 'iPhone 13',
    },
  },
  {
    name: 'existing-user-ready-chromium-slow3g',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'chromium',
      NETWORK_PROFILE: 'slow3g',
      MAX_EXAM_READY_MS: String(Math.max(defaultMaxExamReadyMs, 300_000)),
    },
  },
  {
    name: 'existing-user-ready-transient-offline-blip',
    envOverrides: {
      ...readyBaseEnv,
      BROWSER_NAME: 'chromium',
      TRANSIENT_OFFLINE_BLIP_MS: '5000',
      TRANSIENT_OFFLINE_BLIP_DELAY_MS: '1000',
      MAX_EXAM_READY_MS: String(Math.max(defaultMaxExamReadyMs, 300_000)),
    },
  },
];

for (const scenario of readyScenarios) {
  await addScenario(scenario);
}

if (runLoadConcurrency) {
  const loadScenarios = Array.from({ length: loadWorkers }, (_, index) => ({
    name: `load-concurrency-upload-${index + 1}`,
    envOverrides: {
      FLOW_MODE: 'upload',
      BROWSER_NAME: 'chromium',
      MAX_TOPIC_WAIT_MS: String(Math.max(defaultMaxTopicWaitMs, 8 * 60 * 1000)),
      MAX_EXAM_READY_MS: String(Math.max(defaultMaxExamReadyMs, 4 * 60 * 1000)),
    },
  }));

  const loadResults = await Promise.all(loadScenarios.map((scenario) => runFlow(scenario)));
  for (const result of loadResults) {
    scenarioResults.push({
      name: result.name,
      status: result.status,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
      exitCode: result.exitCode,
      signal: result.signal,
      skipReason: result.skipReason || null,
      runId: result.summary?.runId || null,
      artifactsDir: result.summary?.artifactsDir || null,
      reportJsonPath: result.summary?.reportJsonPath || null,
      reportMdPath: result.summary?.reportMdPath || null,
      finalUrl: result.summary?.finalUrl || null,
      stderr: result.stderr || '',
      stdout: result.stdout || '',
    });
  }
}

const statusCounts = scenarioResults.reduce(
  (acc, scenario) => {
    acc.total += 1;
    if (scenario.status === 'passed') acc.passed += 1;
    else if (scenario.status === 'skipped') acc.skipped += 1;
    else acc.failed += 1;
    return acc;
  },
  { total: 0, passed: 0, skipped: 0, failed: 0 }
);

const failedScenarioNames = scenarioResults
  .filter((scenario) => scenario.status !== 'passed' && scenario.status !== 'skipped')
  .map((scenario) => scenario.name);
const skippedScenarioNames = scenarioResults
  .filter((scenario) => scenario.status === 'skipped')
  .map((scenario) => scenario.name);

const matrixSummary = {
  runId: matrixRunId,
  status: failedScenarioNames.length === 0 ? 'passed' : 'failed',
  startedAt: new Date(matrixStartedAtMs).toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: Date.now() - matrixStartedAtMs,
  baseUrl,
  matrixArtifactsDir,
  config: {
    headless: defaultHeadless,
    maxTopicWaitMs: defaultMaxTopicWaitMs,
    maxExamReadyMs: defaultMaxExamReadyMs,
    runLoadConcurrency,
    loadWorkers: runLoadConcurrency ? loadWorkers : 0,
  },
  bootstrapContext,
  statusCounts,
  failedScenarioNames,
  skippedScenarioNames,
  coverage: {
    accountStates: [
      'new user via upload flow',
      'existing user login flow',
      'repeat existing-user exam launches (proxy for many-attempt account state)',
      'session edge via repeated re-login per ready scenario',
    ],
    topicStates: [
      'initial 0-question generation path from fresh upload',
      'already-generated topic readiness path on existing course',
    ],
    failureConditions: [
      'slow network (Chromium slow3g emulation)',
      'transient network outage during exam loading (offline blip)',
    ],
    browserDevice: [
      'Chromium desktop',
      'Firefox desktop',
      'WebKit iPhone 13 emulation',
    ],
    loadConcurrency: runLoadConcurrency
      ? `${loadWorkers} parallel upload-to-exam flows`
      : 'not run (set RUN_LOAD=1 to include)',
  },
  deterministicRegressionCoverage: [
    'scripts/exam-attempt-stale-record-regression.test.mjs validates regenerated/deleted question-id fallback behavior.',
    'scripts/exam-auto-generation-exhaustion-regression.test.mjs validates forced retry-exhaustion state transitions.',
  ],
  gaps: [
    'No dedicated end-to-end UI path currently triggers explicit question-bank regeneration in the matrix run.',
    'WebKit emulation is not a substitute for physical iOS Safari device validation.',
  ],
  scenarioResults: scenarioResults.map((scenario) => ({
    name: scenario.name,
    status: scenario.status,
    skipReason: scenario.skipReason,
    durationMs: scenario.durationMs,
    timedOut: scenario.timedOut,
    runId: scenario.runId,
    artifactsDir: scenario.artifactsDir,
    reportJsonPath: scenario.reportJsonPath,
    reportMdPath: scenario.reportMdPath,
    finalUrl: scenario.finalUrl,
  })),
};

const reportJsonPath = path.join(matrixArtifactsDir, 'exam-matrix-report.json');
const reportMdPath = path.join(matrixArtifactsDir, 'exam-matrix-report.md');

await fs.writeFile(reportJsonPath, JSON.stringify(matrixSummary, null, 2));

const md = [
  `# Exam Reliability Matrix (${matrixRunId})`,
  '',
  `- Status: ${matrixSummary.status.toUpperCase()}`,
  `- Started: ${matrixSummary.startedAt}`,
  `- Finished: ${matrixSummary.finishedAt}`,
  `- Duration (s): ${(matrixSummary.durationMs / 1000).toFixed(1)}`,
  `- Base URL: ${baseUrl}`,
  `- Passed Scenarios: ${statusCounts.passed}/${statusCounts.total}`,
  `- Skipped Scenarios: ${statusCounts.skipped}/${statusCounts.total}`,
  `- Matrix Artifacts: ${matrixArtifactsDir}`,
  '',
  '## Scenario Results',
  ...matrixSummary.scenarioResults.map(
    (scenario, index) =>
      `${index + 1}. ${scenario.name} - ${scenario.status} (${(scenario.durationMs / 1000).toFixed(
        1
      )}s)${scenario.skipReason ? ` [${scenario.skipReason}]` : ''}${scenario.reportJsonPath ? ` - ${scenario.reportJsonPath}` : ''}`
  ),
  '',
  '## Coverage Notes',
  ...matrixSummary.coverage.accountStates.map((item) => `- Account state: ${item}`),
  ...matrixSummary.coverage.topicStates.map((item) => `- Topic state: ${item}`),
  ...matrixSummary.coverage.failureConditions.map((item) => `- Failure condition: ${item}`),
  ...matrixSummary.coverage.browserDevice.map((item) => `- Browser/device: ${item}`),
  `- Load/concurrency: ${matrixSummary.coverage.loadConcurrency}`,
  ...matrixSummary.deterministicRegressionCoverage.map((item) => `- Deterministic coverage: ${item}`),
  '',
  '## Known Gaps',
  ...matrixSummary.gaps.map((item) => `- ${item}`),
  '',
].join('\n');

await fs.writeFile(reportMdPath, md);

console.log(
  JSON.stringify(
    {
      runId: matrixRunId,
      status: matrixSummary.status,
      reportJsonPath,
      reportMdPath,
      matrixArtifactsDir,
      passed: statusCounts.passed,
      skipped: statusCounts.skipped,
      total: statusCounts.total,
      failedScenarioNames,
      skippedScenarioNames,
    },
    null,
    2
  )
);

if (matrixSummary.status !== 'passed') {
  process.exit(1);
}
