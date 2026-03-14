import fs from "node:fs/promises";

const retrievalSource = await fs.readFile(
  new URL("../convex/lib/groundedRetrieval.ts", import.meta.url),
  "utf8"
);

for (const pattern of [
  "const shouldBackOffVectorWeight =",
  "broadNonNumericVectorBackoff",
  "const lexicalWeight = 0.6 + broadNonNumericVectorBackoff",
  "const vectorWeight = Math.max(0.18, 0.4 - broadNonNumericVectorBackoff)",
  "const vectorOnlyBroadTopicPenalty =",
]) {
  if (!retrievalSource.includes(pattern)) {
    throw new Error(`Expected groundedRetrieval.ts to include \"${pattern}\" for vector-weight backoff tuning.`);
  }
}

console.log("semantic-retrieval-weight-tuning-regression.test.mjs passed");
