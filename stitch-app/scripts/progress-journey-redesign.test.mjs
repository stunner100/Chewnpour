/**
 * Regression: /dashboard/progress journey-first redesign (Phase 1, presentation-only).
 *
 * Asserts the page renders its four sections in order — continue learning,
 * overall activity, courses, topic performance — on top of the real
 * /api/progress payload, uses resumeActivityCopy for the resume card, links
 * the resume CTA to resumeTarget.href, and labels quiz performance honestly
 * (Strong / Developing / Needs review / Not practiced — never "mastery").
 *
 * Run: node scripts/progress-journey-redesign.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const page = readFileSync(join(root, 'src/pages/StudyProgressMastery.jsx'), 'utf8');
const continueCard = readFileSync(
    join(root, 'src/components/progress/ContinueLearningCard.jsx'),
    'utf8',
);
const statsRow = readFileSync(join(root, 'src/components/progress/ActivityStatsRow.jsx'), 'utf8');
const courseList = readFileSync(join(root, 'src/components/progress/CourseProgressList.jsx'), 'utf8');
const topicList = readFileSync(join(root, 'src/components/progress/TopicPerformanceList.jsx'), 'utf8');
const model = readFileSync(join(root, 'src/components/progress/progressModel.js'), 'utf8');

// ── Data layer is untouched: real /api/progress fetch with credentials ──
assert.match(page, /fetch\('\/api\/progress'/, 'page must fetch /api/progress');
assert.match(page, /credentials:\s*'include'/, 'progress fetch must include credentials');
assert.doesNotMatch(page, /from ['"]convex\/react['"]/, 'page must not depend on Convex');

// ── Section order in the page: continue learning → activity → courses → topic performance ──
const continueIdx = page.indexOf('<ContinueLearningCard');
const activityIdx = page.indexOf('<ActivityStatsRow');
const coursesIdx = page.indexOf('<CourseProgressList');
const topicsIdx = page.indexOf('<TopicPerformanceList');
assert.ok(continueIdx > -1, 'page renders the continue learning section');
assert.ok(activityIdx > -1, 'page renders the overall activity section');
assert.ok(coursesIdx > -1, 'page renders the courses section');
assert.ok(topicsIdx > -1, 'page renders the topic performance section');
assert.ok(
    continueIdx < activityIdx && activityIdx < coursesIdx && coursesIdx < topicsIdx,
    'sections must render in order: continue learning, overall activity, courses, topic performance',
);

// ── Continue learning uses resumeActivityCopy and links to resumeTarget.href ──
assert.match(page, /resumeActivityCopy\(resumeTarget\)/, 'page must derive copy via resumeActivityCopy');
assert.match(
    continueCard,
    /resumeTarget\.href \|\| '\/dashboard\/upload'/,
    'resume CTA must link to resumeTarget.href with /dashboard/upload fallback',
);
assert.match(continueCard, /resumeCopy\.badge/, 'resume card must show the copy badge');
assert.match(continueCard, /resumeCopy\.heading/, 'resume card must show the copy heading');
assert.match(continueCard, /resumeCopy\.hint/, 'resume card must show the copy hint');
assert.match(continueCard, /resumeCopy\.cta/, 'resume card CTA must use the copy cta label');
assert.match(continueCard, /progressPercent/, 'resume card must surface real progress percent');

// ── Truthful activity stats only ──
for (const label of ['Study streak', 'Topics practiced', 'Quiz average']) {
    assert.ok(statsRow.includes(label), `activity stats must include "${label}"`);
}
assert.match(page, /overallPreparedness \?\? userStats\?\.accuracy/, 'quiz average must prefer overallPreparedness and fall back to stats.accuracy');

// ── Courses: "X of Y topics practiced" + progress bar ──
assert.match(courseList, /topics practiced/, 'course rows must say "topics practiced"');
assert.match(courseList, /role="progressbar"/, 'course rows must include a progress bar');
assert.match(model, /Math\.round\(\(progress \/ 100\) \* topicCount\)/, 'practiced count must derive from progress % * topicCount');

// ── Honest topic status labels; quiz scores are never "mastery" ──
for (const label of ['Strong', 'Developing', 'Needs review', 'Not practiced']) {
    assert.ok(model.includes(`'${label}'`), `topic performance must include "${label}" status`);
}
assert.match(model, /value >= 80/, 'Strong threshold must be >= 80');
assert.match(model, /value >= 50/, 'Developing threshold must be >= 50');
assert.match(model, /performanceInsights\.needsWork/, 'topic rows must merge the performanceInsights lists');
assert.match(model, /performanceInsights\.progressing/, 'topic rows must merge the progressing list');
assert.match(model, /performanceInsights\.mastered/, 'topic rows must merge the mastered list');
assert.match(topicList, /\\u2014/, 'topics without attempts must show an em dash for score');
assert.match(topicList, /topic\.status/, 'topic rows must render the status label');
for (const rendered of [page, continueCard, statsRow, courseList, topicList]) {
    // Strip the legacy route component identifier (file must keep the name
    // StudyProgressMastery) so only rendered labels/copy are checked.
    const labelsOnly = rendered.replace(/StudyProgressMastery/g, '');
    assert.doesNotMatch(
        labelsOnly,
        /mastery/i,
        'rendered progress UI must never label quiz scores as "mastery"',
    );
}

// ── Calm presentation: skeleton kept, reduced motion respected, no concept review queue ──
assert.match(page, /<ProgressSkeleton \/>/, 'page must keep the ProgressSkeleton loading state');
assert.match(continueCard, /useReducedMotion/, 'motion must respect prefers-reduced-motion');
assert.doesNotMatch(page, /conceptReviewQueue/, 'page must not surface the empty concept review queue stub');

console.log('progress-journey-redesign.test.mjs passed');
