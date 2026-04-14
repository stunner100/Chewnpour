import fs from 'node:fs/promises';
import path from 'node:path';

const root = '/Users/patrickannor/Desktop/stitch_onboarding_name/stitch-app';
const source = await fs.readFile(path.join(root, 'src/pages/ExamMode.jsx'), 'utf8');

const requiredSnippets = [
  'const hasFinalAssessmentRoutingContext = Boolean(topic?.courseId && topic?.sourceUploadId);',
  'const routedFinalAssessmentTopic = useQuery(',
  'api.topics.getFinalAssessmentTopicByCourseAndUpload,',
  "hasFinalAssessmentRoutingContext",
  "routedFinalAssessmentTopic === undefined",
];

for (const snippet of requiredSnippets) {
  if (!source.includes(snippet)) {
    throw new Error(`Expected ExamMode.jsx to include "${snippet}" for final-exam routing.`);
  }
}

console.log('exam-final-routing-query-regression.test.mjs passed');
