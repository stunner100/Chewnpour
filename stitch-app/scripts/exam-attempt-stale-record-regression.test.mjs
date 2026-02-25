import assert from "node:assert/strict";
import { resolveReusableAttemptQuestions } from "../convex/lib/examAttemptReuse.js";

const topicId = "topic_1";
const otherTopicId = "topic_2";

const q1 = { _id: "q1", topicId };
const q2 = { _id: "q2", topicId };

const tests = [
    () => {
        const resolved = resolveReusableAttemptQuestions({
            questionIds: ["q1", "q2"],
            loadedQuestions: [q1, q2],
            topicId,
        });
        assert.deepEqual(
            resolved,
            [q1, q2],
            "Expected reusable questions to preserve requested order when all IDs are valid."
        );
    },
    () => {
        const resolved = resolveReusableAttemptQuestions({
            questionIds: ["q1", "q2"],
            loadedQuestions: [q1, null],
            topicId,
        });
        assert.equal(
            resolved.length,
            0,
            "Expected stale attempt with deleted question records to be non-reusable."
        );
    },
    () => {
        const resolved = resolveReusableAttemptQuestions({
            questionIds: ["old_q1", "old_q2"],
            loadedQuestions: [q1, q2],
            topicId,
        });
        assert.equal(
            resolved.length,
            0,
            "Expected regenerated question bank IDs to invalidate stale reusable attempts."
        );
    },
    () => {
        const resolved = resolveReusableAttemptQuestions({
            questionIds: ["q1", "q2"],
            loadedQuestions: [q1, { _id: "q2", topicId: otherTopicId }],
            topicId,
        });
        assert.equal(
            resolved.length,
            0,
            "Expected topic-mismatched questions to invalidate attempt reuse."
        );
    },
];

for (const run of tests) {
    run();
}

console.log("exam-attempt-stale-record-regression tests passed");
