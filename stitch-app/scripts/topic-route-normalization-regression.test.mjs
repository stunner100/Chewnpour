import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const topicsSource = await fs.readFile(path.join(root, "convex/topics.ts"), "utf8");
const topicDetailSource = await fs.readFile(path.join(root, "src/pages/TopicDetail.jsx"), "utf8");
const examModeSource = await fs.readFile(path.join(root, "src/pages/ExamMode.jsx"), "utf8");
const conceptIntroSource = await fs.readFile(path.join(root, "src/pages/ConceptIntro.jsx"), "utf8");
const conceptBuilderSource = await fs.readFile(path.join(root, "src/pages/ConceptBuilder.jsx"), "utf8");

const backendExpectations = [
  'const resolveTopicIdFromRoute = (ctx: any, routeId: unknown) => {',
  'return ctx.db.normalizeId("topics", normalizedRouteId);',
  'export const getTopicWithQuestions = query({',
  'args: { topicId: v.string() },',
];

for (const snippet of backendExpectations) {
  if (!topicsSource.includes(snippet)) {
    throw new Error(`topics.ts is missing expected route-normalization snippet: ${snippet}`);
  }
}

const pageSources = [
  [topicDetailSource, "TopicDetail.jsx"],
  [examModeSource, "ExamMode.jsx"],
  [conceptIntroSource, "ConceptIntro.jsx"],
  [conceptBuilderSource, "ConceptBuilder.jsx"],
];

for (const [source, label] of pageSources) {
  if (!source.includes("api.topics.getTopicWithQuestions")) {
    throw new Error(`${label} is not using the canonical route-id topic query.`);
  }
  if (!source.includes("routeTopicId ? { topicId: routeTopicId } : 'skip'")) {
    throw new Error(`${label} is not guarding the topic query with routeTopicId.`);
  }
  if (source.includes("isLikelyConvexId")) {
    throw new Error(`${label} still relies on isLikelyConvexId route heuristics.`);
  }
}

console.log("topic-route-normalization-regression.test.mjs passed");
