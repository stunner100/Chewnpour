import fs from "node:fs/promises";

const retrievalSource = await fs.readFile(
  new URL("../convex/lib/groundedRetrieval.ts", import.meta.url),
  "utf8"
);

for (const pattern of [
  "const resolveVectorWeightBackoff =",
  "const vectorWeightBackoff = resolveVectorWeightBackoff",
  "const lexicalWeight = vectorWeightBackoff.lexicalWeight",
  "const vectorWeight = vectorWeightBackoff.vectorWeight",
  "const vectorOnlyBroadTopicPenalty =",
]) {
  if (!retrievalSource.includes(pattern)) {
    throw new Error(`Expected groundedRetrieval.ts to include \"${pattern}\" for vector-weight backoff tuning.`);
  }
}

console.log("semantic-retrieval-weight-tuning-regression.test.mjs passed");
