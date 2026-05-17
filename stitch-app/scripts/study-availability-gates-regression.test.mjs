import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

const helperPath = join(root, 'convex/lib/studyAvailability.ts');
if (!existsSync(helperPath)) {
  throw new Error('Expected a shared Convex studyAvailability helper.');
}

const helperSource = read('convex/lib/studyAvailability.ts');
const coursesSource = read('convex/courses.ts');
const topicsSource = read('convex/topics.ts');
const podcastsSource = read('convex/podcasts.ts');
const tutorSource = read('convex/tutor.ts');
const chatSource = read('convex/topicChat.ts');
const conceptsSource = read('convex/concepts.ts');
const aiSource = read('convex/ai.ts');

const requireIncludes = (source, expected, label) => {
  if (!source.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
};

requireIncludes(helperSource, 'export const isTopicStudyAvailable', 'topic availability predicate');
requireIncludes(helperSource, 'export const assertTopicStudyAvailableOrThrow', 'topic availability assertion');
requireIncludes(helperSource, 'upload.status', 'upload status gate');
requireIncludes(helperSource, 'courseUploads', 'course-upload link gate');

requireIncludes(coursesSource, 'filterStudyAvailableTopics', 'course topic filtering import/use');
requireIncludes(coursesSource, 'const topics = await filterStudyAvailableTopics(ctx, allTopics);', 'getUserCourses study-ready topic filtering');
requireIncludes(coursesSource, 'return null;', 'course list omits courses without study-ready topics');
requireIncludes(coursesSource, 'topics: await filterStudyAvailableTopics(ctx, topics),', 'course detail study-ready topic filtering');

requireIncludes(topicsSource, 'getTopicWithQuestionsPayload(ctx, topicId, { requireStudyAvailable: true })', 'direct topic route availability gate');
requireIncludes(topicsSource, 'getTopicStudyAvailabilityInternal', 'internal topic availability query');
requireIncludes(topicsSource, 'const availability = await isTopicStudyAvailable(ctx, topic);', 'resume target availability gate');
requireIncludes(topicsSource, 'if (!availability.available) continue;', 'resume skips unavailable topics');
requireIncludes(topicsSource, 'filterStudyAvailableTopics(ctx, topics)', 'course topic route filtering');

requireIncludes(podcastsSource, 'assertTopicStudyAvailableOrThrow', 'podcast mutation availability assertion');
requireIncludes(podcastsSource, 'isTopicStudyAvailable', 'podcast query availability gate');
requireIncludes(tutorSource, 'isTopicStudyAvailable', 'tutor context availability gate');
requireIncludes(chatSource, 'assertTopicStudyAvailableOrThrow', 'topic chat write availability assertion');
requireIncludes(conceptsSource, 'isTopicStudyAvailable', 'concept review queue availability gate');
requireIncludes(aiSource, 'getTopicStudyAvailabilityInternal', 'AI action availability check');

console.log('study availability gates regression passed');
