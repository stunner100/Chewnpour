import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const schemaSource = await fs.readFile(path.join(root, 'convex', 'schema.ts'), 'utf8');
const podcastsSource = await fs.readFile(path.join(root, 'convex', 'podcasts.ts'), 'utf8');
const podcastsActionsSource = await fs.readFile(path.join(root, 'convex', 'podcastsActions.ts'), 'utf8');
const aiSource = await fs.readFile(path.join(root, 'convex', 'ai.ts'), 'utf8');
const cronsSource = await fs.readFile(path.join(root, 'convex', 'crons.ts'), 'utf8');
const panelSource = await fs.readFile(
    path.join(root, 'src', 'components', 'TopicPodcastPanel.jsx'),
    'utf8',
);
const topicDetailSource = await fs.readFile(
    path.join(root, 'src', 'pages', 'TopicDetail.jsx'),
    'utf8',
);

if (!/topicPodcasts:\s*defineTable/.test(schemaSource)) {
    throw new Error('Expected schema to define a topicPodcasts table.');
}
if (!/audioStorageId:\s*v\.optional\(v\.id\("_storage"\)\)/.test(schemaSource)) {
    throw new Error('Expected topicPodcasts to persist audio in Convex file storage.');
}
if (!/\.index\("by_status_startedAt", \["status", "startedAt"\]\)/.test(schemaSource)) {
    throw new Error('Expected topicPodcasts to expose a by_status_startedAt index for the stuck-job sweeper.');
}

if (!/export const requestTopicPodcast = mutation\(/.test(podcastsSource)) {
    throw new Error('Expected podcasts.ts to expose a requestTopicPodcast public mutation.');
}
if (!/code: "FEATURE_DISABLED"/.test(podcastsSource)) {
    throw new Error('Expected requestTopicPodcast to gate behind PODCAST_GEN_ENABLED.');
}
if (!/code: "PODCAST_IN_FLIGHT"/.test(podcastsSource)) {
    throw new Error('Expected requestTopicPodcast to dedupe in-flight jobs per user+topic.');
}
if (!/code: "PODCAST_CAPACITY_EXCEEDED"/.test(podcastsSource)) {
    throw new Error('Expected requestTopicPodcast to enforce a global concurrency cap.');
}
if (!/api\.subscriptions\.consumeVoiceGenerationCreditOrThrow/.test(podcastsSource)) {
    throw new Error('Expected requestTopicPodcast to consume the shared voice-generation credit.');
}
if (!/const assertPodcastCapacityAvailable = async/.test(podcastsSource)) {
    throw new Error('Expected podcasts.ts to share capacity checks between request and retry.');
}
if (!/const consumePodcastGenerationCredit = async/.test(podcastsSource)) {
    throw new Error('Expected podcasts.ts to share voice quota checks between request and retry.');
}
if (!/export const sweepStuckPodcastsInternal = internalMutation/.test(podcastsSource)) {
    throw new Error('Expected podcasts.ts to expose sweepStuckPodcastsInternal for the cron sweeper.');
}
if (!/export const retryTopicPodcast = mutation/.test(podcastsSource)) {
    throw new Error('Expected podcasts.ts to expose retryTopicPodcast for failed jobs.');
}
if (!/retryTopicPodcast[\s\S]*await assertPodcastCapacityAvailable\(ctx\);[\s\S]*await consumePodcastGenerationCredit\(ctx, userId\);/.test(podcastsSource)) {
    throw new Error('Expected retryTopicPodcast to enforce capacity and voice quota before requeueing.');
}
if (!/expectedStartedAt:\s*v\.number\(\)/.test(podcastsSource)) {
    throw new Error('Expected podcast state transitions to guard on the active attempt timestamp.');
}
if (!/row\.status !== "running" \|\| row\.startedAt !== args\.expectedStartedAt/.test(podcastsSource)) {
    throw new Error('Expected markReadyInternal to reject stale podcast attempts.');
}

if (!/'use node'|"use node"/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to declare the node runtime for binary audio handling.');
}
if (!/internal\.ai\.generatePodcastScriptInternal/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.kickoff to delegate script generation to ai.generatePodcastScriptInternal.');
}
if (!/const resolveVoiceModels = \(\)/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to resolve separate host and guest voice models.');
}
if (!/const parseDialogueTurns = \(script: string\): DialogueTurn\[] =>/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to parse HOST and GUEST dialogue turns.');
}
if (!/chunk\.speaker === "HOST" \? hostVoiceModel : guestVoiceModel/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to synthesize host and guest turns with different voice models.');
}
if (!/\/v1\/speak\?model=/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to call the Deepgram /v1/speak endpoint.');
}
if (!/encoding=mp3/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to request MP3 audio output.');
}
if (!/ctx\.storage\.store\(blob\)/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to persist the synthesized audio in Convex file storage.');
}
if (!/internal\.podcasts\.markReadyInternal/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to mark the row ready after storage.');
}
if (!/internal\.podcasts\.markFailedInternal/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.ts to record failures via markFailedInternal.');
}
if (!/const attemptStartedAt = row\.startedAt/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.kickoff to capture the active attempt timestamp.');
}
if (!/expectedStartedAt: attemptStartedAt/.test(podcastsActionsSource)) {
    throw new Error('Expected podcastsActions.kickoff to guard state transitions by attempt timestamp.');
}

if (!/export const generatePodcastScriptInternal = internalAction/.test(aiSource)) {
    throw new Error('Expected ai.ts to expose generatePodcastScriptInternal.');
}
if (!/Every spoken turn must begin with either 'HOST:' or 'GUEST:'/i.test(aiSource)) {
    throw new Error('Expected the script generator to require HOST and GUEST dialogue turns.');
}
if (!/PODCAST_SCRIPT_TOO_SHORT/.test(aiSource)) {
    throw new Error('Expected the script generator to reject scripts that are too short to use.');
}

if (!/internal\.podcasts\.sweepStuckPodcastsInternal/.test(cronsSource)) {
    throw new Error('Expected crons.ts to schedule the podcast stuck-job sweeper.');
}

if (!/api\.podcasts\.requestTopicPodcast/.test(panelSource)) {
    throw new Error('Expected TopicPodcastPanel to call api.podcasts.requestTopicPodcast.');
}
if (!/two-speaker audio explainer/.test(panelSource)) {
    throw new Error('Expected TopicPodcastPanel copy to describe the two-speaker format.');
}
if (!/<audio\b/.test(panelSource)) {
    throw new Error('Expected TopicPodcastPanel to render an <audio> element when ready.');
}
if (!/api\.podcasts\.retryTopicPodcast/.test(panelSource)) {
    throw new Error('Expected TopicPodcastPanel to expose a retry path for failed podcasts.');
}
if (!/class TopicPodcastPanelBoundary extends Component/.test(panelSource)) {
    throw new Error('Expected TopicPodcastPanel to isolate podcast query failures from the topic page.');
}

if (!/import TopicPodcastPanel from '\.\.\/components\/TopicPodcastPanel'/.test(topicDetailSource)) {
    throw new Error('Expected TopicDetail.jsx to import TopicPodcastPanel.');
}
if (!/VITE_PODCAST_GEN_ENABLED/.test(topicDetailSource)) {
    throw new Error('Expected TopicDetail.jsx to gate the podcast panel on VITE_PODCAST_GEN_ENABLED.');
}
if (!/<TopicPodcastPanel\b/.test(topicDetailSource)) {
    throw new Error('Expected TopicDetail.jsx to mount the TopicPodcastPanel.');
}

console.log('topic-podcast-generation-regression.test.mjs passed');
