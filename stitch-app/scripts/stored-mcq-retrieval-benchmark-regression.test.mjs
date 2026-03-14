import fs from "node:fs/promises";

const groundedSource = await fs.readFile(
  new URL("../convex/grounded.ts", import.meta.url),
  "utf8"
);

for (const pattern of [
  "export const benchmarkStoredMcqRetrievalAB = internalAction({",
  "benchmark: \"stored_mcq_retrieval_ab\"",
  "vectorActiveQuestionCount",
  "improvedQuestionsCount",
  "questionText: questionText.slice(0, 180)",
]) {
  if (!groundedSource.includes(pattern)) {
    throw new Error(`Expected grounded.ts to include \"${pattern}\" for stored MCQ retrieval benchmarking.`);
  }
}

console.log("stored-mcq-retrieval-benchmark-regression.test.mjs passed");
