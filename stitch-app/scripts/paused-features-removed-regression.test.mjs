import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Paused features (Kids, Humanizer, Assignment helper, Community, Concept
// builder/intro, Flashcards) and the old Profile/Subscription pages are
// deleted, not parked: no stub pages and no routes that render them.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');

assert.doesNotMatch(app, /ParkedFeatureView|ParkedDashboardFeature/, 'App.jsx must not render parked feature stubs');
for (const path of [
    '/kids',
    '/dashboard/kids',
    '/dashboard/flashcards',
    '/dashboard/assignment-helper',
    '/dashboard/humanizer',
    '/dashboard/community',
    '/dashboard/concept-intro',
    '/dashboard/concept',
]) {
    assert.ok(!app.includes(`path="${path}"`), `App.jsx must not route ${path}`);
}

for (const file of [
    'src/components/ParkedFeatureView.jsx',
    'src/pages/Kids.jsx',
    'src/pages/AIHumanizer.jsx',
    'src/pages/AssignmentHelper.jsx',
    'src/pages/Community.jsx',
    'src/pages/CommunityChannel.jsx',
    'src/pages/ConceptBuilder.jsx',
    'src/pages/ConceptIntro.jsx',
    'src/pages/FlashcardStudySession.jsx',
    'src/pages/FillInExercise.jsx',
    'src/pages/Profile.jsx',
    'src/pages/Subscription.jsx',
    'src/pages/SubscriptionCallback.jsx',
]) {
    assert.equal(existsSync(join(root, file)), false, `${file} should be deleted`);
}

console.log('paused-features-removed-regression.test.mjs passed');
