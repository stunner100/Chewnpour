import assert from "node:assert/strict";
import {
    assertAuthorizedUser,
    computeExamPercentage,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "../convex/lib/examSecurity.js";

const tests = [
    () => {
        const authUserId = resolveAuthUserId({ subject: "user_123" });
        assert.equal(authUserId, "user_123", "Expected subject to resolve as authenticated user id");
    },
    () => {
        assert.throws(
            () => assertAuthorizedUser({ authUserId: "", requestedUserId: "user_1" }),
            /Not authenticated/,
            "Expected unauthenticated access to throw"
        );
    },
    () => {
        assert.throws(
            () => assertAuthorizedUser({ authUserId: "user_1", requestedUserId: "user_2" }),
            /permission/i,
            "Expected mismatched requested user access to throw"
        );
    },
    () => {
        const safe = sanitizeExamQuestionForClient({
            _id: "q1",
            questionText: "What is 2 + 2?",
            options: [{ label: "A", text: "4" }],
            correctAnswer: "A",
        });
        assert.equal(Object.prototype.hasOwnProperty.call(safe, "correctAnswer"), false, "Expected correctAnswer to be removed from client payload");
        assert.equal(safe.questionText, "What is 2 + 2?", "Expected question text to remain");
    },
    () => {
        const percentage = computeExamPercentage({ score: 0, totalQuestions: 0, fallbackTotal: 0 });
        assert.equal(percentage, 0, "Expected zero-question exam percentage to resolve to 0");
    },
    () => {
        const percentage = computeExamPercentage({ score: 12, totalQuestions: 25 });
        assert.equal(percentage, 48, "Expected normal exam percentage to be computed correctly");
    },
];

for (const run of tests) {
    run();
}

console.log("exam-security-regression tests passed");
