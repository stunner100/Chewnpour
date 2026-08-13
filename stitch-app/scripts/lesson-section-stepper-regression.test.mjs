import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFile(path.join(root, rel), "utf8");

const app = await read("src/App.jsx");
const topicDetail = await read("src/pages/TopicDetail.jsx");
const contentPanel = await read("src/components/topic/TopicContentPanel.jsx");
const stepper = await read("src/components/lesson/LessonSectionStepper.jsx");
const inlineCheck = await read("src/components/lesson/LessonInlineCheck.jsx");
const renderer = await read("src/components/LessonContentRenderer.jsx");
const hook = await read("src/hooks/useTopicDetail.js");
const quizPlayer = await read("src/pages/TopicQuizPlayer.jsx");
const courses = await read("server/courses.js");
const exams = await read("server/exams.js");

assert.match(app, /TopicDetail/, "App must still mount TopicDetail");
assert.match(topicDetail, /TopicLessonShell/, "TopicDetail must render the lesson shell");
assert.match(contentPanel, /LessonSectionStepper/, "lesson page must mount the section stepper");
assert.doesNotMatch(contentPanel, /GuidedStudyPath/, "guided study path must not remain on the lesson page");
assert.match(stepper, /Section \{clampedIndex \+ 1\} of \{total\}/, "stepper must show section progress");
assert.match(stepper, /lesson-reading-stage/, "lesson prose must sit in a defined reading stage");
assert.ok(
    stepper.indexOf("</article>") < stepper.indexOf("<LessonInlineCheck"),
    "inline checks must sit outside the reading article",
);
assert.match(stepper, /LessonInlineCheck/, "stepper must render the inline check");
assert.match(stepper, /Next section/, "stepper must continue after an attempt");
assert.match(inlineCheck, /\/lesson-check/, "inline checks must grade on the server");
assert.doesNotMatch(renderer, /quickcheck_widget/, "live reader must not render reveal-card quick checks");
assert.doesNotMatch(renderer, /ordering_widget/, "ordering belongs in the stepper, not the article renderer");
assert.doesNotMatch(hook, /quickcheck_widget/, "topic hook must not inject markdown Q/A widgets");
assert.match(quizPlayer, /\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/quiz/, "quiz route must stay MCQ quiz API");
assert.match(courses, /surface, 'quiz'\) = 'quiz'/, "quiz queries must require surface=quiz");
assert.match(exams, /surface, 'quiz'\) = 'quiz'/, "exams must exclude in-lesson checks");

console.log("lesson-section-stepper-regression.test.mjs passed");
