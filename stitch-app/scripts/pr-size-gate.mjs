import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_LIMITS = {
  maxChangedFiles: 60,
  maxTotalLineChurn: 2500,
  maxSingleFileLineChurn: 900,
  maxSourceFileLines: 900,
};

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.css',
  '.py',
]);

const ALWAYS_IGNORED_PATHS = [
  /^stitch-app\/dist\//,
  /^stitch-app\/node_modules\//,
  /^stitch-app\/convex\/_generated\//,
  /^docling-service\/\.venv\//,
  /^\.playwright-mcp\//,
  /^qa-results\//,
];

const CHURN_IGNORED_PATHS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)npm-shrinkwrap\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,
  /^stitch-app\/public\//,
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

export const resolveLimits = (env = process.env) => ({
  maxChangedFiles: parsePositiveInteger(env.PR_SIZE_MAX_CHANGED_FILES, DEFAULT_LIMITS.maxChangedFiles),
  maxTotalLineChurn: parsePositiveInteger(env.PR_SIZE_MAX_TOTAL_LINE_CHURN, DEFAULT_LIMITS.maxTotalLineChurn),
  maxSingleFileLineChurn: parsePositiveInteger(env.PR_SIZE_MAX_SINGLE_FILE_LINE_CHURN, DEFAULT_LIMITS.maxSingleFileLineChurn),
  maxSourceFileLines: parsePositiveInteger(env.PR_SIZE_MAX_SOURCE_FILE_LINES, DEFAULT_LIMITS.maxSourceFileLines),
});

const isIgnoredPath = (filePath) =>
  ALWAYS_IGNORED_PATHS.some((pattern) => pattern.test(filePath));

const isChurnIgnoredPath = (filePath) =>
  CHURN_IGNORED_PATHS.some((pattern) => pattern.test(filePath));

const isSourceFile = (filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath));

const countFileLines = (filePath) => {
  try {
    const content = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
    if (!content) return 0;
    return content.endsWith('\n')
      ? content.split('\n').length - 1
      : content.split('\n').length;
  } catch {
    return 0;
  }
};

export function parseNumstat(raw) {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [addedRaw, deletedRaw, ...pathParts] = line.split('\t');
      const filePath = pathParts.join('\t');
      const additions = Number(addedRaw);
      const deletions = Number(deletedRaw);
      return {
        filePath,
        additions: Number.isFinite(additions) ? additions : 0,
        deletions: Number.isFinite(deletions) ? deletions : 0,
      };
    })
    .filter((entry) => entry.filePath && !isIgnoredPath(entry.filePath));
}

export function evaluatePrSize(entries, fileLineCounts = {}, limits = DEFAULT_LIMITS) {
  const violations = [];
  const changedFiles = entries.length;
  const churnEntries = entries.filter((entry) => !isChurnIgnoredPath(entry.filePath));
  const totalLineChurn = churnEntries.reduce(
    (total, entry) => total + entry.additions + entry.deletions,
    0
  );

  if (changedFiles > limits.maxChangedFiles) {
    violations.push(
      `Changed files ${changedFiles} exceeds limit ${limits.maxChangedFiles}. Split this PR.`
    );
  }

  if (totalLineChurn > limits.maxTotalLineChurn) {
    violations.push(
      `Line churn ${totalLineChurn} exceeds limit ${limits.maxTotalLineChurn}. Split this PR.`
    );
  }

  for (const entry of churnEntries) {
    const lineChurn = entry.additions + entry.deletions;
    const netAddedLines = entry.additions - entry.deletions;
    const lineCount = fileLineCounts[entry.filePath] ?? 0;

    if (lineChurn > limits.maxSingleFileLineChurn) {
      violations.push(
        `${entry.filePath} changed ${lineChurn} lines; limit is ${limits.maxSingleFileLineChurn}.`
      );
    }

    if (
      isSourceFile(entry.filePath) &&
      lineCount > limits.maxSourceFileLines &&
      netAddedLines > 0
    ) {
      violations.push(
        `${entry.filePath} is ${lineCount} lines and grew by ${netAddedLines}. Split or shrink it first.`
      );
    }
  }

  return {
    changedFiles,
    totalLineChurn,
    violations,
  };
}

const git = (...args) =>
  execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const main = () => {
  const baseRef = process.argv[2] || process.env.PR_SIZE_BASE_REF || 'origin/master';
  const rawNumstat = git('diff', '--numstat', '--find-renames', `${baseRef}...HEAD`);
  const entries = parseNumstat(rawNumstat);
  const fileLineCounts = Object.fromEntries(
    entries.map((entry) => [entry.filePath, countFileLines(entry.filePath)])
  );
  const result = evaluatePrSize(entries, fileLineCounts, resolveLimits());

  console.log(`PR size gate: ${result.changedFiles} changed files, ${result.totalLineChurn} counted line churn.`);

  if (result.violations.length > 0) {
    console.error('\nPR size gate failed:');
    for (const violation of result.violations) {
      console.error(`- ${violation}`);
    }
    console.error('\nUse smaller PRs or refactor oversized files before adding behavior.');
    process.exit(1);
  }

  console.log('PR size gate passed.');
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
