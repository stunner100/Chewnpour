import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const playerPath = resolve(root, 'src', 'components', 'podcast', 'PodcastWaveformPlayer.jsx');
const panelPath = resolve(root, 'src', 'components', 'TopicPodcastPanel.jsx');
const dashboardPodcastsPath = resolve(root, 'src', 'pages', 'DashboardPodcasts.jsx');

const playerSource = readFileSync(playerPath, 'utf8');
const panelSource = readFileSync(panelPath, 'utf8');
const dashboardPodcastsSource = readFileSync(dashboardPodcastsPath, 'utf8');

for (const token of [
  'role="slider"',
  'onPointerDown={handlePointerDown}',
  'onPointerMove={handlePointerMove}',
  'onKeyDown={handleKeyDown}',
  'audioRef',
  'buildWaveform',
  'aria-valuenow',
  "playing ? 'pause' : 'play_arrow'",
]) {
  assert.ok(
    playerSource.includes(token),
    `Expected PodcastWaveformPlayer to support animated waveform scrubbing via ${token}.`,
  );
}

assert.ok(
  !/from ['"]convex\/react['"]/.test(panelSource),
  'Expected TopicPodcastPanel to stay Convex-free.',
);

assert.ok(
  !dashboardPodcastsSource.includes('<audio')
    && dashboardPodcastsSource.includes("import PodcastWaveformPlayer from '../components/podcast/PodcastWaveformPlayer'")
    && dashboardPodcastsSource.includes('<PodcastWaveformPlayer'),
  'Expected DashboardPodcasts to use the custom waveform player instead of native audio controls.',
);

console.log('podcast-waveform-player-regression.test.mjs passed');
