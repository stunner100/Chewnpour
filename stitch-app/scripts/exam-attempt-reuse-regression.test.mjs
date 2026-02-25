import assert from "node:assert/strict";
import {
    EXAM_ATTEMPT_REUSE_MAX_AGE_MS,
    canReuseExamAttempt,
} from "../convex/lib/examAttemptReuse.js";

const now = Date.now();
const baseAttempt = {
    _creationTime: now - 5 * 60 * 1000,
    topicId: "topic_1",
    questionIds: ["q1", "q2"],
    answers: [],
    score: 0,
};

const tests = [
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: baseAttempt,
                topicId: "topic_1",
                nowMs: now,
            }),
            true,
            "Expected empty recent attempt for same topic to be reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, topicId: "topic_2" },
                topicId: "topic_1",
                nowMs: now,
            }),
            false,
            "Expected attempts from other topics to be non-reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, answers: [{ questionId: "q1", selectedAnswer: "A" }] },
                topicId: "topic_1",
                nowMs: now,
            }),
            false,
            "Expected attempts with saved answers to be non-reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, _creationTime: now - EXAM_ATTEMPT_REUSE_MAX_AGE_MS - 1 },
                topicId: "topic_1",
                nowMs: now,
            }),
            false,
            "Expected stale attempts to be non-reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, examFormat: "mcq" },
                topicId: "topic_1",
                examFormat: "essay",
                nowMs: now,
            }),
            false,
            "Expected exam format mismatch to block attempt reuse."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, examFormat: "essay" },
                topicId: "topic_1",
                examFormat: "essay",
                nowMs: now,
            }),
            true,
            "Expected matching exam formats to keep attempt reusable."
        );
    },
];

for (const run of tests) {
    run();
}

console.log("exam-attempt-reuse-regression tests passed");
