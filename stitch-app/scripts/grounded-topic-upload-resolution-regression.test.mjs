import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const groundedSource = await fs.readFile(
    path.join(root, "convex/grounded.ts"),
    "utf8"
);

const requiredSnippets = [
    "const sourceUploadId = topic?.sourceUploadId;",
    "courseId: topic.courseId,",
    "api.courses.getCourseSources",
    "return await loadGroundedEvidenceIndexFromUpload(ctx, fallbackUpload);",
];

for (const snippet of requiredSnippets) {
    if (!groundedSource.includes(snippet)) {
        throw new Error(`Expected grounded upload resolution to include snippet: ${snippet}`);
    }
}

console.log("grounded topic upload resolution regression passed");
