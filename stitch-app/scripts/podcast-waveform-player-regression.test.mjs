import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const playerPath = resolve(root, 'src', 'components', 'podcast', 'PodcastWaveformPlayer.jsx');
const panelPath = resolve(root, 'src', 'components', 'TopicPodcastPanel.jsx');
const dashboardPodcastsPath = resolve(root, 'src', 'pages', 'DashboardPodcasts.jsx');
const lessonCardPath = resolve(root, 'src', 'components', 'lesson', 'LessonPodcastCard.jsx');
const iconPath = resolve(root, 'src', 'components', 'AppIcon.jsx');

const playerSource = readFileSync(playerPath, 'utf8');
const panelSource = readFileSync(panelPath, 'utf8');
const dashboardPodcastsSource = readFileSync(dashboardPodcastsPath, 'utf8');
const lessonCardSource = readFileSync(lessonCardPath, 'utf8');
const iconSource = readFileSync(iconPath, 'utf8');

for (const token of [
  'role="slider"',
  'onPointerDown={handlePointerDown}',
  'onPointerMove={handlePointerMove}',
  'onKeyDown={handleKeyDown}',
  'audioRef',
  'aria-valuenow',
  'aria-valuetext={timeLabel}',
  "playing ? 'Pause podcast' : 'Play podcast'",
  'SKIP_SECONDS = 15',
  'seekBySeconds(-SKIP_SECONDS)',
  'seekBySeconds(SKIP_SECONDS)',
  'h-11 cursor-pointer',
  'bg-cta text-cta-foreground',
]) {
  assert.ok(
    playerSource.includes(token),
    `Expected PodcastWaveformPlayer to keep a usable scrubber via ${token}.`,
  );
}

assert.ok(
  !playerSource.includes('buildWaveform'),
  'Expected the player to stop drawing a fake seeded waveform.',
);
assert.ok(
  !playerSource.includes('#130d24'),
  'Expected the player to use theme tokens instead of a nested dark island.',
);
assert.ok(
  !playerSource.includes('hover:scale-105'),
  'Expected play not to move its hit target on hover.',
);
assert.ok(
  !playerSource.includes('<track kind="captions"'),
  'Expected the empty captions track to be removed.',
);
assert.ok(
  !/{title &&/.test(playerSource) && !playerSource.includes('truncate text-body-sm font-semibold'),
  'Expected the player not to repeat the topic title next to the time.',
);

assert.ok(
  iconSource.includes('skip_previous: SkipBackIcon'),
  'Expected skip_previous to map to SkipBackIcon for the 15-second skip control.',
);

assert.ok(
  !lessonCardSource.includes('text-overline'),
  'Expected the lesson podcast heading to lead without an eyebrow label.',
);
assert.ok(
  /<h3 className="min-w-0 text-body-lg font-semibold text-text-primary/.test(lessonCardSource),
  'Expected the topic title to be the first heading in the podcast section.',
);
assert.ok(
  lessonCardSource.includes("isInFlight ? 'Generating…' : 'Regenerate'"),
  'Expected regenerate to stay available after the player, not beside the title.',
);
assert.ok(
  !lessonCardSource.includes('flex items-start justify-between gap-3'),
  'Expected regenerate not to sit in a header row competing with Play.',
);

assert.ok(
  !/from ['"]convex\/react['"]/.test(panelSource),
  'Expected TopicPodcastPanel to stay Convex-free.',
);

assert.ok(
  !dashboardPodcastsSource.includes('<audio')
    && dashboardPodcastsSource.includes("import PodcastWaveformPlayer from '../components/podcast/PodcastWaveformPlayer'")
    && dashboardPodcastsSource.includes('<PodcastWaveformPlayer'),
  'Expected DashboardPodcasts to use the custom player instead of native audio controls.',
);

console.log('podcast-waveform-player-regression.test.mjs passed');
