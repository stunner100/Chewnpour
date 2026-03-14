import fs from "node:fs/promises";

const aiSource = await fs.readFile(
  new URL("../convex/ai.ts", import.meta.url),
  "utf8"
);

for (const pattern of [
  "export const benchmarkTutorExplainLatency = internalAction({",
  "benchmark: \"assistant_path_latency\"",
  "averageAdditionalRetrievalMs",
  "buildSelectionExcerptForBenchmark",
  "vectorActiveSampleCount",
]) {
  if (!aiSource.includes(pattern)) {
    throw new Error(`Expected ai.ts to include \"${pattern}\" for assistant path latency benchmarking.`);
  }
}

console.log("assistant-path-latency-benchmark-regression.test.mjs passed");
