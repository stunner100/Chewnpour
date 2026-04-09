import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const schemaSource = await fs.readFile(path.join(root, "convex", "schema.ts"), "utf8");
const topicsSource = await fs.readFile(path.join(root, "convex", "topics.ts"), "utf8");
const coursesSource = await fs.readFile(path.join(root, "convex", "courses.ts"), "utf8");
const aiSource = await fs.readFile(path.join(root, "convex", "ai.ts"), "utf8");
const topicDetailSource = await fs.readFile(path.join(root, "src", "pages", "TopicDetail.jsx"), "utf8");
const examModeSource = await fs.readFile(path.join(root, "src", "pages", "ExamMode.jsx"), "utf8");
const dashboardCourseSource = await fs.readFile(path.join(root, "src", "pages", "DashboardCourse.jsx"), "utf8");
const nextStepsSource = await fs.readFile(path.join(root, "src", "components", "NextStepsGuidance.jsx"), "utf8");

const schemaExpectations = [
  "topicKind: v.optional(v.string())",
  "assessmentClassification: v.optional(v.string())",
  "assessmentRoute: v.optional(v.string())",
  "assessmentRouteReason: v.optional(v.string())",
  "assessmentReadinessScore: v.optional(v.number())",
  '.index("by_courseId_topicKind", ["courseId", "topicKind"])',
];

for (const snippet of schemaExpectations) {
  if (!schemaSource.includes(snippet)) {
    throw new Error(`schema.ts is missing adaptive-routing snippet: ${snippet}`);
  }
}

const backendExpectations = [
  "export const getFinalAssessmentTopicByCourseAndUpload = query({",
  "export const updateTopicAssessmentRoutingInternal = internalMutation({",
  "export const upsertDocumentFinalExamTopicInternal = internalMutation({",
  "topicKind: TOPIC_KIND_LESSON",
  "assessmentRoute: ASSESSMENT_ROUTE_TOPIC_QUIZ",
  "const syncAssessmentRoutingForUpload = async (ctx: any, args:",
  "await syncAssessmentRoutingForUpload(ctx, {",
  'reason: "ASSESSMENT_ROUTED_TO_FINAL_EXAM"',
  "if (topic && !allowsStandaloneTopicExam(topic)) {",
];

for (const snippet of backendExpectations) {
  if (!topicsSource.includes(snippet) && !aiSource.includes(snippet)) {
    throw new Error(`Backend adaptive-routing snippet missing: ${snippet}`);
  }
}

if (!coursesSource.includes("const finalAssessmentTopics = topics")) {
  throw new Error("courses.ts is not separating finalAssessmentTopics from lesson topics.");
}

if (!coursesSource.includes("topics: lessonTopics")) {
  throw new Error("courses.ts is not returning lessonTopics as the course topics payload.");
}

const topicDetailExpectations = [
  "api.topics.getFinalAssessmentTopicByCourseAndUpload",
  "const examTopicId = isTopicQuizRoute",
  "Covered in Final Exam",
  "Take Final Exam",
  "examTopicId={examTopicId}",
];

for (const snippet of topicDetailExpectations) {
  if (!topicDetailSource.includes(snippet)) {
    throw new Error(`TopicDetail adaptive-routing snippet missing: ${snippet}`);
  }
}

const examModeExpectations = [
  "api.topics.getFinalAssessmentTopicByCourseAndUpload",
  "const shouldRedirectToFinalExam = (",
  "navigate(`/dashboard/exam/${routedFinalAssessmentTopic._id}`",
  "This topic is covered in the final exam",
];

for (const snippet of examModeExpectations) {
  if (!examModeSource.includes(snippet)) {
    throw new Error(`ExamMode adaptive-routing snippet missing: ${snippet}`);
  }
}

if (!dashboardCourseSource.includes("const finalAssessmentTopics = Array.isArray(displayCourse?.finalAssessmentTopics)")) {
  throw new Error("DashboardCourse.jsx is not reading finalAssessmentTopics from the course payload.");
}

if (!dashboardCourseSource.includes("Final Exam")) {
  throw new Error("DashboardCourse.jsx is missing the final exam card section.");
}

if (!dashboardCourseSource.includes("routeBadge")) {
  throw new Error("DashboardCourse.jsx is missing topic assessment route badges.");
}

if (!nextStepsSource.includes("examTopicId = topicId")) {
  throw new Error("NextStepsGuidance.jsx must default examTopicId to topicId.");
}

console.log("adaptive-assessment-routing-regression.test.mjs passed");
