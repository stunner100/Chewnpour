import fs from "node:fs/promises";

const groundedSource = await fs.readFile(
  new URL("../convex/grounded.ts", import.meta.url),
  "utf8"
);

const requiredPatterns = [
  "export const benchmarkSemanticRetrievalAB = internalAction({",
  "numericOnly: v.optional(v.boolean())",
  "topicIds: v.optional(v.array(v.id(\"topics\")))",
  "benchmark: \"semantic_retrieval_ab\"",
  "numericOnly,",
  "vectorActiveTopicCount",
  "averageRecallAtK",
  "improvedTopicsCount",
  "improvedVectorActiveTopicsCount",
  "samples: {",
];

for (const pattern of requiredPatterns) {
  if (!groundedSource.includes(pattern)) {
    throw new Error(`Expected grounded.ts to include \"${pattern}\" for retrieval A/B benchmarking.`);
  }
}

console.log("semantic-retrieval-ab-benchmark-regression.test.mjs passed");
