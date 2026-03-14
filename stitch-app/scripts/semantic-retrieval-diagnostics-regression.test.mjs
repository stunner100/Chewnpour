import fs from "node:fs/promises";

const [groundedSource, retrievalSource] = await Promise.all([
  fs.readFile(new URL("../convex/grounded.ts", import.meta.url), "utf8"),
  fs.readFile(new URL("../convex/lib/groundedRetrieval.ts", import.meta.url), "utf8"),
]);

for (const pattern of [
  'export const diagnoseSemanticRetrievalForTopic = internalAction({',
  'debug: true',
  'diagnostics: hybrid.diagnostics',
  'diagnostics: lexical.diagnostics',
]) {
  if (!groundedSource.includes(pattern)) {
    throw new Error(`Expected grounded.ts to include "${pattern}" for per-topic retrieval diagnostics.`);
  }
}

for (const pattern of [
  'diagnostics?: {',
  'vectorWeightBackoff:',
  'const resolveVectorWeightBackoff =',
  'const toDiagnosticsEntry =',
  'rerankedTop:',
]) {
  if (!retrievalSource.includes(pattern)) {
    throw new Error(`Expected groundedRetrieval.ts to include "${pattern}" for rerank diagnostics.`);
  }
}

console.log("semantic-retrieval-diagnostics-regression.test.mjs passed");
