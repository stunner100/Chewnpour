import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import {
  asciiDownloadFilename,
  buildExtractedSourceMarkdown,
  buildLessonsMarkdown,
  buildQuizzesMarkdown,
  buildTransformedExportZip,
  sanitizeExportFileStem,
} from "../server/materialExport.js";

assert.equal(sanitizeExportFileStem("Holy Roman Empire.pdf"), "Holy-Roman-Empire");
assert.equal(asciiDownloadFilename("Holy Roman Empire.zip"), "Holy-Roman-Empire.zip");

const extracted = buildExtractedSourceMarkdown({
  fileName: "notes.pdf",
  extractedText: "The empire split into principalities.",
  pageCount: 4,
  charCount: 38,
});
assert.match(extracted, /# Extracted source/);
assert.match(extracted, /From: notes.pdf/);
assert.match(extracted, /The empire split into principalities/);

const lessons = buildLessonsMarkdown({
  title: "German History",
  fileName: "notes.pdf",
  topics: [
    { title: "Fragmentation", description: "Why power split", content: "Local princes kept authority." },
  ],
});
assert.match(lessons, /# German History/);
assert.match(lessons, /## 1. Fragmentation/);
assert.match(lessons, /Local princes kept authority/);

const quizzes = buildQuizzesMarkdown({
  quizzes: [
    {
      topicTitle: "Fragmentation",
      prompt: "Who kept local authority?",
      options: ["The emperor", "Local princes"],
      correctIndex: 1,
      explanation: "Imperial power was limited.",
      surface: "quiz",
    },
  ],
});
assert.match(quizzes, /Who kept local authority/);
assert.match(quizzes, /Answer: B. Local princes/);

const exported = buildTransformedExportZip({
  fileName: "notes.pdf",
  title: "German History",
  extractedText: "Source text here.",
  pageCount: 2,
  charCount: 16,
  topics: [{ title: "Fragmentation", content: "Lesson body." }],
  quizzes: [
    {
      topicTitle: "Fragmentation",
      prompt: "A question?",
      options: ["Yes", "No"],
      correctIndex: 0,
      surface: "in_lesson",
    },
  ],
});
assert.equal(exported.filename, "German-History-chewnpour.zip");
assert.equal(exported.mimeType, "application/zip");
assert.equal(exported.fileCount, 3);

const unzipped = unzipSync(new Uint8Array(exported.body));
assert.ok(unzipped["extracted-source.md"]);
assert.ok(unzipped["lessons.md"]);
assert.ok(unzipped["quizzes.md"]);
assert.match(strFromU8(unzipped["lessons.md"]), /Lesson body/);
assert.match(strFromU8(unzipped["quizzes.md"]), /In-lesson check/);

try {
  buildTransformedExportZip({ fileName: "empty.pdf" });
  throw new Error("Expected empty export to fail");
} catch (error) {
  assert.equal(error.code, "EXPORT_NOT_READY");
  assert.equal(error.status, 409);
}

console.log("material-export-regression.test.mjs passed");
