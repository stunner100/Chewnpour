import assert from 'node:assert/strict';
import { classifyPostSignupPath, extractCourseIdFromDashboardUrl } from './lib/playwrightExamFlowRouting.mjs';

assert.equal(classifyPostSignupPath('/dashboard'), 'dashboard');
assert.equal(classifyPostSignupPath('/onboarding/level'), 'level');
assert.equal(classifyPostSignupPath('/onboarding/department'), 'department');
assert.equal(classifyPostSignupPath('/signup'), 'unknown');

assert.equal(
  extractCourseIdFromDashboardUrl('https://www.chewnpour.com/dashboard/processing/jh123abc'),
  'jh123abc'
);
assert.equal(
  extractCourseIdFromDashboardUrl('https://www.chewnpour.com/dashboard/course/jh456def?x=1'),
  'jh456def'
);
assert.equal(extractCourseIdFromDashboardUrl('https://www.chewnpour.com/dashboard'), null);

console.log('playwright-exam-flow-routing-regression: ok');
