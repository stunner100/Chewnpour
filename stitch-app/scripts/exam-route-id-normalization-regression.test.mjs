import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFile(path.join(root, relativePath), 'utf8');

const [coursesSource, topicsSource, examPreparationsSource] = await Promise.all([
  read('convex/courses.ts'),
  read('convex/topics.ts'),
  read('convex/examPreparations.ts'),
]);

for (const [source, tableName, helperName] of [
  [coursesSource, 'courses', 'resolveCourseIdFromRoute'],
  [topicsSource, 'topics', 'resolveTopicIdFromRoute'],
  [examPreparationsSource, 'topics', 'resolveTopicIdFromRoute'],
]) {
  if (!source.includes(`const ${helperName} = (ctx: any, routeId: unknown) => {`)) {
    throw new Error(`Expected ${helperName} helper for ${tableName} route normalization.`);
  }
  if (!source.includes(`return ctx.db.normalizeId("${tableName}", normalizedRouteId);`)) {
    throw new Error(`Expected ${helperName} to normalize ${tableName} ids from route strings.`);
  }
}

if (!/export const getCourseWithTopics = query\(\{\s*args:\s*\{\s*courseId:\s*v\.string\(\)\s*\}/s.test(coursesSource)) {
  throw new Error('Expected getCourseWithTopics to accept a string course route id.');
}

if (!/export const getCourseSources = query\(\{\s*args:\s*\{\s*courseId:\s*v\.string\(\)\s*\}/s.test(coursesSource)) {
  throw new Error('Expected getCourseSources to accept a string course route id.');
}

if (!/const courseId = resolveCourseIdFromRoute\(ctx, args\.courseId\);/.test(coursesSource)) {
  throw new Error('Expected course queries to normalize route course ids before lookup.');
}

if (!/export const getTopicWithQuestions = query\(\{\s*args:\s*\{\s*topicId:\s*v\.string\(\)\s*\}/s.test(topicsSource)) {
  throw new Error('Expected getTopicWithQuestions to accept a string topic route id.');
}

if (!/const topicId = resolveTopicIdFromRoute\(ctx, args\.topicId\);/.test(topicsSource)) {
  throw new Error('Expected getTopicWithQuestions to normalize route topic ids before lookup.');
}

if (!/export const startExamPreparation = action\(\{\s*args:\s*\{[\s\S]*topicId:\s*v\.string\(\)/s.test(examPreparationsSource)) {
  throw new Error('Expected startExamPreparation to accept a string topic route id.');
}

if (!/const topicId = resolveTopicIdFromRoute\(ctx, args\.topicId\);/.test(examPreparationsSource)) {
  throw new Error('Expected startExamPreparation to normalize the route topic id before preparation.');
}

if (!/code:\s*"TOPIC_NOT_FOUND"/.test(examPreparationsSource)) {
  throw new Error('Expected startExamPreparation to report TOPIC_NOT_FOUND for invalid route topic ids.');
}

console.log('exam-route-id-normalization-regression.test.mjs passed');
