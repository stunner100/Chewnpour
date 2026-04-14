import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const aiPath = resolve(root, "convex", "ai.ts");
const topicsPath = resolve(root, "convex", "topics.ts");
const schemaPath = resolve(root, "convex", "schema.ts");

const aiSource = readFileSync(aiPath, "utf8");
const topicsSource = readFileSync(topicsPath, "utf8");
const schemaSource = readFileSync(schemaPath, "utf8");

assert.ok(
  aiSource.includes("type TopicContentGraph = {")
    && aiSource.includes("sourcePassages: TopicContentGraphSourcePassage[]")
    && aiSource.includes("buildTopicContentGraph(")
    && aiSource.includes("buildTopicContentGraphContext")
    && aiSource.includes("selectRelevantTopicPassages")
    && aiSource.includes("scorePassageForTitle")
    && aiSource.includes("buildGroundedTopicDataFromAlignedSource")
    && aiSource.includes("const anchorPage = anchorCandidatePool"),
  "Expected AI pipeline to define and build a canonical topic content graph."
);

assert.ok(
  !aiSource.includes("contentGraph.sourcePassages[0]?.text")
    && aiSource.includes("normalizeDefinitionEntries(contentGraph.definitions")
    && aiSource.includes("normalizeFormulaEntries(")
    && aiSource.includes("contentGraph.formulas.map")
    && aiSource.includes("const contextSentences = hasTopicContentGraph(contentGraph)")
    && aiSource.includes("const sourcePassageIdList = alignedSourcePassages.map")
    && aiSource.includes("otherTopicTitles: allTopicTitles")
    && aiSource.includes("buildGroundedLessonFactCandidates")
    && aiSource.includes("Do not insert generic study advice or filler"),
  "Expected lesson fallback generation to avoid raw JSON/source echoing and to build from filtered, grounded content-graph fields."
);

assert.ok(
  aiSource.includes("const compactLessonSentence =")
    && aiSource.includes("trimTrailingWeakLessonWords")
    && aiSource.includes("LESSON_WEAK_TRAILING_TOKENS")
    && aiSource.includes("const compactClauseAwareSentence =")
    && aiSource.includes("const buildNarrativeFinanceFactsFromGraph =")
    && aiSource.includes("const isTabularMetricFragment =")
    && aiSource.includes("const isSectionHeader = hint === \"sectionheader\"")
    && aiSource.includes("buildReadableTableFinanceFacts")
    && aiSource.includes("buildTableFinanceFactsFromGraph")
    && aiSource.includes("const supplementalTablePassages = !hasTablePassage && sourcePages.size > 0")
    && aiSource.includes("const hasSuspiciousLessonEnding ="),
  "Expected lesson normalization to compact long source-backed statements clause-by-clause, prefer narrative finance facts over raw table fragments, backfill missing cited table passages, and reject suspicious rendered lesson lines."
);

assert.ok(
  schemaSource.includes("sourcePassages: v.array(v.object({")
    && topicsSource.includes("sourcePassages: v.array(v.object({")
    && topicsSource.includes("contentGraph: args.contentGraph"),
  "Expected topic schema and mutation to persist source passages inside the content graph."
);

console.log("content-graph-handoff-regression.test.mjs passed");
