import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPath = path.join(root, 'convex', 'admin.ts');
const dashboardPath = path.join(root, 'src', 'pages', 'AdminDashboard.jsx');

const [adminSource, dashboardSource] = await Promise.all([
  fs.readFile(adminPath, 'utf8'),
  fs.readFile(dashboardPath, 'utf8'),
]);

for (const snippet of [
  'ctx.db\n                    .query("questionTargetAuditRuns")',
  'const latestQuestionTargetAuditRun = questionTargetAuditRuns[0] || null;',
  'const latestQuestionTargetAuditWithRebases =',
  'questionTargetAudit: {',
  'latestRun: mapQuestionTargetAuditRun(latestQuestionTargetAuditRun),',
  'latestRunWithRebases: mapQuestionTargetAuditRun(latestQuestionTargetAuditWithRebases),',
]) {
  if (!adminSource.includes(snippet)) {
    throw new Error(`Expected admin.ts to include "${snippet}" for admin audit diagnostics.`);
  }
}

for (const snippet of [
  'title="Question Target Audit"',
  'const questionTargetAudit = snapshot.questionTargetAudit || {};',
  'const latestAudit = questionTargetAudit.latestRun || null;',
  'const latestAuditWithRebases = questionTargetAudit.latestRunWithRebases || null;',
  'Rebased Topics',
  'latest effective audit',
]) {
  if (!dashboardSource.includes(snippet)) {
    throw new Error(`Expected AdminDashboard.jsx to include "${snippet}" for target audit visibility.`);
  }
}

console.log('admin-question-target-audit-panel-regression.test.mjs passed');
