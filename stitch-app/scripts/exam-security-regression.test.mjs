import assert from "node:assert/strict";
import {
    assertAuthorizedUser,
    computeExamPercentage,
    ensureUniqueAnswerQuestionIds,
    hasUsableExamOptions,
    isUsableExamQuestion,
    resolveAuthUserId,
    sanitizeExamQuestionForClient,
} from "../convex/lib/examSecurity.js";

const getConvexErrorCode = (error) => {
    if (typeof error?.data?.code === "string" && error.data.code.trim()) {
        return error.data.code.trim();
    }
    try {
        const parsed = JSON.parse(String(error?.message || ""));
        if (typeof parsed?.code === "string" && parsed.code.trim()) {
            return parsed.code.trim();
        }
    } catch {
        // Ignore non-JSON error messages.
    }
    return "";
};

const tests = [
    () => {
        const authUserId = resolveAuthUserId({ subject: "user_123" });
        assert.equal(authUserId, "user_123", "Expected subject to resolve as authenticated user id");
    },
    () => {
        try {
            assertAuthorizedUser({ authUserId: "", requestedUserId: "user_1" });
            assert.fail("Expected unauthenticated access to throw");
        } catch (error) {
            assert.match(String(error?.message || ""), /Not authenticated/i);
            assert.equal(getConvexErrorCode(error), "UNAUTHENTICATED");
        }
    },
    () => {
        try {
            assertAuthorizedUser({ authUserId: "user_1", requestedUserId: "user_2" });
            assert.fail("Expected mismatched requested user access to throw");
        } catch (error) {
            assert.match(String(error?.message || ""), /permission/i);
            assert.equal(getConvexErrorCode(error), "UNAUTHORIZED");
        }
    },
    () => {
        const safe = sanitizeExamQuestionForClient({
            _id: "q1",
            questionText: "What is 2 + 2?",
            options: [
                { label: "A", text: "4", isCorrect: true },
                { label: "B", text: "3", isCorrect: false },
            ],
            correctAnswer: "A",
        });
        assert.equal(Object.prototype.hasOwnProperty.call(safe, "correctAnswer"), false, "Expected correctAnswer to be removed from client payload");
        assert.equal(
            Object.prototype.hasOwnProperty.call(safe.options[0], "isCorrect"),
            false,
            "Expected options to remove isCorrect from client payload"
        );
        assert.equal(safe.questionText, "What is 2 + 2?", "Expected question text to remain");
    },
    () => {
        ensureUniqueAnswerQuestionIds([
            { questionId: "q1", selectedAnswer: "A" },
            { questionId: "q2", selectedAnswer: "B" },
        ]);
    },
    () => {
        assert.throws(
            () =>
                ensureUniqueAnswerQuestionIds([
                    { questionId: "q1", selectedAnswer: "A" },
                    { questionId: "q1", selectedAnswer: "A" },
                ]),
            /duplicate/i,
            "Expected duplicate question answers to throw"
        );
    },
    () => {
        const percentage = computeExamPercentage({ score: 0, totalQuestions: 0, fallbackTotal: 0 });
        assert.equal(percentage, 0, "Expected zero-question exam percentage to resolve to 0");
    },
    () => {
        const percentage = computeExamPercentage({ score: 12, totalQuestions: 25 });
        assert.equal(percentage, 48, "Expected normal exam percentage to be computed correctly");
    },
    () => {
        assert.equal(
            hasUsableExamOptions([
                { label: "A", text: "Marriage involving one spouse and multiple partners." },
                { label: "B", text: "Marriage where each person has only one spouse at a time." },
                { label: "C", text: "A legal contract for business partnerships only." },
                { label: "D", text: "A temporary engagement before formal marriage." },
            ]),
            true,
            "Expected high-quality specific options to be marked usable"
        );
    },
    () => {
        assert.equal(
            hasUsableExamOptions([
                { label: "A", text: "A" },
                { label: "B", text: "None of the above" },
                { label: "C", text: "All of the above" },
                { label: "D", text: "Cannot be determined from the question" },
            ]),
            false,
            "Expected placeholder/generic options to be rejected"
        );
    },
    () => {
        assert.equal(
            isUsableExamQuestion({
                questionText: "What is the definition of polygamy?",
                options: [
                    { label: "A", text: "A" },
                    { label: "B", text: "None of the above" },
                    { label: "C", text: "All of the above" },
                    { label: "D", text: "Cannot be determined from the question" },
                ],
            }),
            false,
            "Expected generic MCQ records to be excluded from exam usage"
        );
    },
];

for (const run of tests) {
    run();
}

console.log("exam-security-regression tests passed");
