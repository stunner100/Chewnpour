import assert from "node:assert/strict";
import { canReuseExamAttempt } from "../convex/lib/examAttemptReuse.js";

const baseAttempt = {
    _creationTime: Date.now() - 24 * 60 * 60 * 1000,
    startedAt: Date.now() - 24 * 60 * 60 * 1000,
    topicId: "topic_1",
    questionIds: ["q1", "q2"],
    answers: [],
    score: 0,
    questionSetVersion: 123,
    assessmentVersion: "assessment-blueprint-v3",
};
const currentTopic = {
    _creationTime: 1,
    questionSetVersion: 123,
};

const tests = [
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: baseAttempt,
                topicId: "topic_1",
                topic: currentTopic,
                assessmentVersion: "assessment-blueprint-v3",
            }),
            true,
            "Expected empty untouched attempt for the active topic/version to be reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, topicId: "topic_2" },
                topicId: "topic_1",
                topic: currentTopic,
                assessmentVersion: "assessment-blueprint-v3",
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
                topic: currentTopic,
                assessmentVersion: "assessment-blueprint-v3",
            }),
            false,
            "Expected attempts with saved answers to be non-reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: baseAttempt,
                topicId: "topic_1",
                topic: { ...currentTopic, questionSetVersion: 456 },
                assessmentVersion: "assessment-blueprint-v3",
            }),
            false,
            "Expected attempts from a previous topic question-set version to be non-reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, examFormat: "mcq" },
                topicId: "topic_1",
                examFormat: "essay",
                topic: currentTopic,
                assessmentVersion: "assessment-blueprint-v3",
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
                topic: currentTopic,
                assessmentVersion: "assessment-blueprint-v3",
            }),
            true,
            "Expected matching exam formats to keep attempt reusable."
        );
    },
    () => {
        assert.equal(
            canReuseExamAttempt({
                attempt: { ...baseAttempt, assessmentVersion: "assessment-blueprint-v2" },
                topicId: "topic_1",
                topic: currentTopic,
                assessmentVersion: "assessment-blueprint-v3",
            }),
            false,
            "Expected assessment-version mismatch to invalidate attempt reuse."
        );
    },
];

for (const run of tests) {
    run();
}

console.log("exam-attempt-reuse-regression tests passed");
