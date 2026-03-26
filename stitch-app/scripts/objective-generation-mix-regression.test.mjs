import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const [aiSource, topicsSource, topicDetailSource, examModeSource] = await Promise.all([
    fs.readFile(path.join(root, "convex", "ai.ts"), "utf8"),
    fs.readFile(path.join(root, "convex", "topics.ts"), "utf8"),
    fs.readFile(path.join(root, "src", "pages", "TopicDetail.jsx"), "utf8"),
    fs.readFile(path.join(root, "src", "pages", "ExamMode.jsx"), "utf8"),
]);

for (const pattern of [
    /const generateTrueFalseQuestionCandidatesBatch = async/,
    /const generateFillBlankQuestionCandidatesBatch = async/,
    /const generateTrueFalseQuestionGapBatch = async/,
    /const generateFillBlankQuestionGapBatch = async/,
    /const persistObjectiveCandidate = async/,
    /questionType === QUESTION_TYPE_TRUE_FALSE[\s\S]*generateTrueFalseQuestionGapBatch/,
    /questionType === QUESTION_TYPE_FILL_BLANK[\s\S]*generateFillBlankQuestionGapBatch/,
    /questionType:\s*normalizedQuestionType/,
]) {
    if (!pattern.test(aiSource)) {
        throw new Error("Expected ai.ts to generate and persist true/false plus fill-in-the-blank objective questions.");
    }
}

for (const pattern of [
    /templateParts:\s*v\.optional\(v\.array\(v\.string\(\)\)\)/,
    /acceptedAnswers:\s*v\.optional\(v\.array\(v\.string\(\)\)\)/,
    /fillBlankMode:\s*v\.optional\(v\.string\(\)\)/,
]) {
    if (!pattern.test(topicsSource)) {
        throw new Error("Expected topics.ts question mutations to accept fill-in-the-blank persistence fields.");
    }
}

if (!/Objective Quiz/.test(topicDetailSource)) {
    throw new Error("Expected TopicDetail.jsx to expose the mixed objective quiz label.");
}
if (!/Multiple choice, true\/false, and fill in the blank/.test(examModeSource)) {
    throw new Error("Expected ExamMode.jsx to describe the mixed objective question types.");
}

console.log("objective-generation-mix-regression.test.mjs passed");
