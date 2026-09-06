import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

const quizPlayer = await read("src/pages/TopicQuizPlayer.jsx");
const results = await read("src/pages/DashboardResults.jsx");
const quizQuestion = await read("src/components/quiz/QuizQuestion.jsx");
const quizProgress = await read("src/components/quiz/QuizProgress.jsx");
const helpers = await read("src/lib/topicLessonHelpers.js");
const nextSteps = await read("src/components/NextStepsGuidance.jsx");
const courseHttp = await read("server/courseHttp.js");

// ─── One question at a time (focus mode) ────────────────────────────────────
assert.match(quizPlayer, /const \[questionIndex, setQuestionIndex\] = useState\(0\)/, "player must track the visible question index");
assert.match(quizPlayer, /const currentQuestion = questions\[questionIndex\]/, "player must derive the single visible question");
assert.match(quizPlayer, /<QuizProgress current=\{questionIndex\} total=\{total\} \/>/, "player must render focus progress");
assert.match(quizPlayer, /<QuizQuestion/, "player must render the single-question component");
assert.match(quizProgress, /Question \{current \+ 1\} of \{total\}/, "progress must label 'Question X of N'");
assert.match(quizProgress, /role="progressbar"/, "progress bar must expose an aria progressbar");

// Back / Continue controls
assert.match(quizPlayer, /const handleBack = useCallback/, "player must provide a Back control");
assert.match(quizPlayer, /const handleContinue = useCallback/, "player must provide a Continue control");
assert.match(quizPlayer, />\s*Continue\s*</, "Continue button label present");
assert.match(quizPlayer, /Submit quiz/, "final question submits the quiz");
assert.match(quizPlayer, /disabled=\{!hasCurrentSelection\}/, "Continue stays disabled until an answer is selected");

// Must NOT render every question at once
assert.doesNotMatch(quizPlayer, /questions\.map\(\(question, index\)\s*=>/, "player must not map all questions into one form");
assert.doesNotMatch(quizPlayer, /result \? \(/, "the dead in-player result panel branch must be removed");

// Submit still posts the same payload shape
assert.match(quizPlayer, /answers: questions\.map\(\(question\) => \(\{[\s\S]*?questionId: question\.id[\s\S]*?selectedIndex:/, "submit must post { answers: [{ questionId, selectedIndex }] }");
assert.match(quizPlayer, /-1,/, "unanswered questions remain skipped (-1)");
assert.match(quizPlayer, /navigate\(`\/dashboard\/quiz\/results\//, "submit navigates to the results route");

// Reduced-motion aware transitions
assert.match(quizPlayer, /useReducedMotion/, "player must honor reduced motion");
assert.match(quizPlayer, /AnimatePresence/, "player must animate question changes");
assert.match(quizPlayer, /key=\{questionIndex\}/, "question scene keyed by index");

// ─── No `autostart` emitted from src (excluding test-only examModeState) ────
const autostartPattern = /autostart/;
const srcFiles = [
    ["TopicQuizPlayer.jsx", quizPlayer],
    ["DashboardResults.jsx", results],
    ["topicLessonHelpers.js", helpers],
    ["NextStepsGuidance.jsx", nextSteps],
];
for (const [label, source] of srcFiles) {
    assert.ok(!autostartPattern.test(source), `${label} must not emit ?autostart`);
}
// Route builders produce clean routes (no query string)
assert.match(helpers, /topicId \? `\/dashboard\/quiz\/\$\{topicId\}` : '\/dashboard'/, "topic quiz route has no query string");
assert.doesNotMatch(helpers, /\?autostart|\?format=/, "route builders must not append autostart/format query strings");

// ─── Results page: truthful, no heuristic AI feedback ───────────────────────
assert.doesNotMatch(results, /buildHeuristicTutorFeedback/, "results must not fake tutor feedback");
assert.doesNotMatch(results, /TutorReport/, "results must not render the heuristic tutor report");
assert.doesNotMatch(results, /extractReadinessLabel/, "results must not derive a readiness badge");
assert.doesNotMatch(results, /buildDifficultyBreakdown|DifficultyPills/, "results must not show a hardcoded difficulty breakdown");
assert.doesNotMatch(results, /buildBloomBreakdown|BloomBreakdown/, "results must not show a Bloom breakdown for objective attempts");
// Real summary fields
assert.match(results, /\$\{correctCount\} \/ \$\{totalQuestions\} correct/, "results show the real score summary");
assert.match(results, /Quiz complete/, "results overline present");
// Real understanding lists
assert.match(results, /Strong areas/, "results list strong areas from real answers");
assert.match(results, /Needs review/, "results list missed questions");
// Question review collapsed by default
assert.match(results, /<details/, "question review must be collapsed by default");
assert.match(results, /id="question-review"/, "question review anchor present for Review mistakes");
// Retry link has no autostart
assert.doesNotMatch(results, /\?autostart/, "retry link must not include autostart");

// ─── Server: quiz submit records quiz activity ──────────────────────────────
assert.match(courseHttp, /lastActivityKind: "quiz",\n\s*bestScore: result\.percent,/, "quiz submit must set lastActivityKind 'quiz'");

console.log("quiz-focus-mode-regression.test.mjs passed");
