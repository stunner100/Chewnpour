import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const modulePath = path.join(root, "convex", "lib", "groundedEvidenceIndex.ts");

const inlineModule = `
const grounded = await import(${JSON.stringify(modulePath)});
const artifact = {
  pages: [
    {
      index: 0,
      text: [
        "Big Idea",
        "Active reading means reading with a clear purpose. Good note-taking turns what you read into a compact study tool that is easier to review later.",
        "Key Ideas",
        "- Survey the text before reading in detail",
        "- Ask questions before and during reading",
        "- Review notes later to strengthen recall",
        "Step-by-Step Breakdown",
        "1. Survey the title, headings, and diagrams first",
        "2. Turn headings into questions before reading",
        "3. Write concise Cornell-style notes after each section",
        "Summary",
        "Questioning, purposeful reading, and structured notes help students study with better focus and stronger recall."
      ].join("\\n")
    }
  ]
};

const index = grounded.buildGroundedEvidenceIndexFromArtifact({
  artifact,
  uploadId: "upload-segmentation-test",
});

console.log(JSON.stringify({
  version: grounded.GROUNDED_EVIDENCE_INDEX_VERSION,
  passageCount: index.passageCount,
  passages: index.passages.map((passage) => ({
    passageId: passage.passageId,
    sectionHint: passage.sectionHint,
    text: passage.text,
  })),
}));
`;

const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "-e", inlineModule],
    {
        cwd: root,
        encoding: "utf8",
    },
);

if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to evaluate grounded evidence index module.");
}

const payload = JSON.parse(result.stdout.trim());

if (payload.version !== "grounded-v2") {
    throw new Error(`Expected grounded evidence index version grounded-v2, received ${payload.version || "unknown"}.`);
}

if (!Number.isFinite(payload.passageCount) || payload.passageCount < 3) {
    throw new Error(`Expected a single-page outline artifact to split into at least 3 passages, received ${payload.passageCount}.`);
}

const sectionHints = new Set(
    (Array.isArray(payload.passages) ? payload.passages : [])
        .map((passage) => String(passage?.sectionHint || "").trim())
        .filter(Boolean)
);

for (const expectedHint of ["Big Idea", "Key Ideas", "Step-by-Step Breakdown"]) {
    if (!sectionHints.has(expectedHint)) {
        throw new Error(`Expected segmented passages to preserve the ${expectedHint} section as its own hint.`);
    }
}

console.log("evidence-passage-segmentation-regression.test.mjs passed");
