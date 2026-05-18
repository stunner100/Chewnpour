import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const readSource = (path) => fs.readFile(new URL(path, import.meta.url), 'utf8');

const [
  librarySource,
  uploadSource,
  processingSource,
  flashcardsSource,
  examPreparationSource,
  topicPodcastSource,
  coursePodcastSource,
  dashboardPodcastsSource,
  podcastStatusBadgeSource,
  voicePlaybackSource,
  examAutoGenerationSource,
  highlightExplainSource,
  fillInExerciseSource,
  dashboardResultsSource,
] = await Promise.all([
  readSource('../src/pages/MyMaterialsLibrary.jsx'),
  readSource('../src/pages/UploadMaterials.jsx'),
  readSource('../src/pages/DashboardProcessing.jsx'),
  readSource('../src/pages/FlashcardStudySession.jsx'),
  readSource('../src/components/ExamPreparationLoader.jsx'),
  readSource('../src/components/TopicPodcastPanel.jsx'),
  readSource('../src/components/course/CoursePodcastCard.jsx'),
  readSource('../src/pages/DashboardPodcasts.jsx'),
  readSource('../src/components/dashboard/PodcastStatusBadge.jsx'),
  readSource('../src/lib/useVoicePlayback.js'),
  readSource('../src/lib/examAutoGenerationState.js'),
  readSource('../src/components/HighlightExplainPopover.jsx'),
  readSource('../src/pages/FillInExercise.jsx'),
  readSource('../src/pages/DashboardResults.jsx'),
]);

for (const forbidden of [
  'getUserFacingUploadErrorMessage',
  'errorMessage: getUserFacingUploadErrorMessage',
  'material.errorMessage',
  'Processing failed',
  'Study Unavailable',
  'No study content',
  'Content not generated',
  'Study unavailable',
  'Could not generate',
  'Word Bank must include',
  'Lesson sections are repeating',
]) {
  assert.ok(
    !librarySource.includes(forbidden),
    `My Materials must not expose generated-content failure copy: ${forbidden}`,
  );
}

assert.ok(
  !/material\.status === 'error'[\s\S]{0,240}>\s*Error\s*</.test(librarySource),
  'My Materials must not label generated-content states as Error.',
);

assert.ok(
  !/normalized === 'error'[\s\S]{0,220}label:\s*['"]Failed['"]/.test(uploadSource),
  'Upload recent cards must not label generated-content states as Failed.',
);

assert.ok(
  !/normalized === 'error'[\s\S]{0,260}icon:\s*['"]error['"]/.test(uploadSource),
  'Upload recent cards must not show an error icon for generated-content states.',
);

assert.ok(
  !/normalized === 'error'[\s\S]{0,260}bg-error-soft text-error/.test(uploadSource),
  'Upload recent cards must not use error styling for generated-content states.',
);

for (const forbidden of [
  'Processing encountered an issue',
  'Redirecting to available content',
]) {
  assert.ok(
    !processingSource.includes(forbidden),
    `Processing page must not expose generated-content failure copy: ${forbidden}`,
  );
}

const generatedStudySurfaceSource = [
  flashcardsSource,
  examPreparationSource,
  topicPodcastSource,
  coursePodcastSource,
  dashboardPodcastsSource,
  podcastStatusBadgeSource,
  voicePlaybackSource,
  examAutoGenerationSource,
  highlightExplainSource,
  fillInExerciseSource,
  dashboardResultsSource,
].join('\n');

for (const forbidden of [
  'Generation Failed',
  'generation failed',
  'generation stopped',
  'generation took too long',
  'Failed to generate',
  'failed to generate',
  'Quiz Preparation Failed',
  'Fill-in Generation Failed',
  'Podcast generation failed',
  'AI voice generation failed',
  'Voice playback failed',
  'Regenerate Word Bank',
  'Word Bank needs regeneration',
  'valid Word Bank',
  'Could not regenerate',
  'Could not generate tutor feedback',
  'Not enough content to generate',
  'No Word Bank',
]) {
  assert.ok(
    !generatedStudySurfaceSource.includes(forbidden),
    `Generated study surfaces must not expose failure/regeneration copy: ${forbidden}`,
  );
}

console.log('learner-generation-errors-hidden-regression.test.mjs passed');
