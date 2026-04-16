import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');
const topicsSource = await fs.readFile(path.join(root, 'convex', 'topics.ts'), 'utf8');
const routingSource = await fs.readFile(path.join(root, 'convex', 'lib', 'assessmentRouting.js'), 'utf8');

for (const snippet of [
  'supportedQuestionTypes,',
  'strongestNeighborOverlap,',
]) {
  if (!routingSource.includes(snippet)) {
    throw new Error(`Expected routing diagnostics to still be computed in assessmentRouting.js: ${snippet}`);
  }
}

if (!aiSource.includes('const routingPatch = {')) {
  throw new Error('Expected syncAssessmentRoutingForUpload to build an explicit routingPatch payload.');
}

for (const field of [
  'topicKind: routing.topicKind,',
  'assessmentClassification: routing.assessmentClassification,',
  'assessmentRoute: routing.assessmentRoute,',
  'assessmentRouteReason: routing.assessmentRouteReason,',
  'assessmentReadinessScore: routing.assessmentReadinessScore,',
  'evidenceVolumeScore: routing.evidenceVolumeScore,',
  'evidenceDiversityScore: routing.evidenceDiversityScore,',
  'distinctivenessScore: routing.distinctivenessScore,',
  'questionVarietyScore: routing.questionVarietyScore,',
  'redundancyRiskScore: routing.redundancyRiskScore,',
]) {
  if (!aiSource.includes(field)) {
    throw new Error(`Expected routingPatch to include ${field}`);
  }
}

if (aiSource.includes('await ctx.runMutation(internal.topics.updateTopicAssessmentRoutingInternal, {\n            topicId: topic._id,\n            ...routing,')) {
  throw new Error('Regression detected: syncAssessmentRoutingForUpload must not spread the raw routing object into the mutation payload.');
}

if (!topicsSource.includes('questionVarietyScore: v.number(),')) {
  throw new Error('Expected updateTopicAssessmentRoutingInternal to remain explicitly validator-backed.');
}

console.log('routing-sync-payload-regression.test.mjs passed');
