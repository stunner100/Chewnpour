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
const studyProgress = await read("src/hooks/useStudyProgress.js");
const quizPlayer = await read("src/pages/TopicQuizPlayer.jsx");
const courses = await read("server/courses.js");
const exams = await read("server/exams.js");

assert.match(app, /TopicDetail/, "App must still mount TopicDetail");
assert.match(topicDetail, /TopicLessonShell/, "TopicDetail must render the lesson shell");
assert.match(contentPanel, /LessonSectionStepper/, "lesson page must mount the section stepper");
assert.doesNotMatch(contentPanel, /GuidedStudyPath/, "guided study path must not remain on the lesson page");
assert.match(stepper, /lesson-reading-stage/, "lesson prose must sit in a defined reading stage");
assert.match(stepper, /AnimatePresence/, "section transitions must animate subtly");
assert.match(stepper, /useReducedMotion/, "section transitions must respect reduced motion");
assert.match(stepper, /Continue/, "stepper must offer a continue control");
assert.match(stepper, /Finish lesson/, "stepper must finish on the last section");
assert.match(stepper, /onFinishLesson/, "finishing must persist completion via the hook");
assert.match(stepper, /initialIndex/, "stepper must restore the persisted section index");
assert.match(hook, /useStudyProgress/, "topic hook must reuse the study-progress session hook");
assert.match(hook, /studyContext/, "topic hook must expose the current section to the tutor");
assert.match(studyProgress, /studyPosition/, "study progress must persist the current section on topic_progress");
assert.match(studyProgress, /\/passages/, "study progress must fetch real source passages");
assert.doesNotMatch(hook, /const sourcePassages = \[\]/, "source passages must not stay hardcoded empty");
assert.match(stepper, /LessonCompletion/, "finishing must show the completion moment");
assert.ok(
    stepper.indexOf("</Motion.div>") < stepper.indexOf("border-t border-border-subtle"),
    "progression controls must follow the section content",
);
assert.match(stepper, /LessonInlineCheck/, "stepper must render the inline check");
assert.match(inlineCheck, /\/lesson-check/, "inline checks must grade on the server");
assert.match(inlineCheck, /Quick check/, "inline check must read as part of the lesson");
assert.match(inlineCheck, /Try again/, "wrong answers must allow a retry");
assert.match(inlineCheck, /Ask AI Tutor/, "wrong answers must offer tutor help");
assert.doesNotMatch(renderer, /quickcheck_widget/, "live reader must not render reveal-card quick checks");
assert.doesNotMatch(renderer, /ordering_widget/, "ordering belongs in the stepper, not the article renderer");
assert.doesNotMatch(hook, /quickcheck_widget/, "topic hook must not inject markdown Q/A widgets");
assert.match(quizPlayer, /\/api\/topics\/\$\{encodeURIComponent\(topicId\)\}\/quiz/, "quiz route must stay MCQ quiz API");
assert.doesNotMatch(quizPlayer, /autostart/, "quiz player must not consume the dead autostart param");
assert.match(courses, /surface, 'quiz'\) = 'quiz'/, "quiz queries must require surface=quiz");
assert.match(exams, /surface, 'quiz'\) = 'quiz'/, "exams must exclude in-lesson checks");

console.log("lesson-section-stepper-regression.test.mjs passed");
