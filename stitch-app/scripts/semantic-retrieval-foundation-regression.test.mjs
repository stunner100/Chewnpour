import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const [schemaSource, groundedSource, retrievalSource, aiSource, envExample] = await Promise.all([
  fs.readFile(path.join(root, "convex", "schema.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "grounded.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "lib", "groundedRetrieval.ts"), "utf8"),
  fs.readFile(path.join(root, "convex", "ai.ts"), "utf8"),
  fs.readFile(path.join(root, ".env.example"), "utf8"),
]);

for (const requiredPattern of [
  'evidencePassages: defineTable({',
  'searchDocuments: defineTable({',
  '.searchIndex("search_body"',
  'embeddingsStatus: v.optional(v.string())',
  'embeddedPassageCount: v.optional(v.number())',
]) {
  if (!schemaSource.includes(requiredPattern)) {
    throw new Error(`Expected schema.ts to include "${requiredPattern}" for semantic retrieval/search foundation.`);
  }
}

for (const requiredPattern of [
  'export const materializeEvidencePassagesForUpload = internalAction({',
  'buildMaterializedEvidenceRows',
  'grounded.materializeEvidencePassagesForUpload',
  'insertEvidencePassageBatch',
  'lexical-structured-passages',
]) {
  if (!groundedSource.includes(requiredPattern)) {
    throw new Error(`Expected grounded.ts to include "${requiredPattern}" for passage materialization.`);
  }
}

for (const requiredPattern of [
  'GROUNDED_VECTOR_RETRIEVAL_ENABLED',
  'numericAgreement',
  'hybrid_lexical_only',
  'retrievalSource: "lexical"',
]) {
  if (!retrievalSource.includes(requiredPattern)) {
    throw new Error(`Expected groundedRetrieval.ts to include "${requiredPattern}" for structured lexical retrieval.`);
  }
}

if (schemaSource.includes('.vectorIndex("by_embedding"')) {
  throw new Error("evidencePassages.by_embedding must stay removed to keep Convex index memory down.");
}

for (const requiredPattern of [
  'retrievalMode: effectiveRetrieval.retrievalMode',
  '[GroundedRetrieval] topic_retrieval_completed',
  'SOURCE EVIDENCE:',
  'queryFragments: [question]',
  'queryFragments: [selectedText, args.style]',
]) {
  if (!aiSource.includes(requiredPattern)) {
    throw new Error(`Expected ai.ts to include "${requiredPattern}" for grounded semantic retrieval cutover.`);
  }
}

for (const requiredPattern of [
  'VOYAGE_EMBEDDINGS_MODEL=voyage-large-2',
  'VOYAGE_EMBEDDINGS_TIMEOUT_MS=20000',
  'GROUNDED_VECTOR_RETRIEVAL_ENABLED=false',
]) {
  if (!envExample.includes(requiredPattern)) {
    throw new Error(`Expected .env.example to include "${requiredPattern}" for embeddings configuration.`);
  }
}

console.log("semantic-retrieval-foundation-regression.test.mjs passed");
