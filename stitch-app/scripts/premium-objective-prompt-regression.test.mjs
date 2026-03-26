import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const source = await fs.readFile(
  path.join(process.cwd(), "convex", "lib", "groundedGeneration.ts"),
  "utf8"
);

for (const requiredSnippet of [
  "The stem should sound like a university assessment item, not a flashcard.",
  "Default to interpretation, application, comparison, or diagnosis before simple definition recall.",
  "All distractors must be plausible, evidence-adjacent, and free of giveaway wording.",
  "Prefer claim-evaluation statements that require careful reading or application, not textbook one-liners.",
  "False statements must be meaningfully wrong, not just a single swapped word.",
  "Prefer sentence-completion or concept-application blanks over isolated term recall.",
  "The blank must carry the concept-bearing part of the sentence.",
]) {
  assert.equal(
    source.includes(requiredSnippet),
    true,
    `Expected grounded objective prompt contract to include: ${requiredSnippet}`
  );
}

console.log("premium-objective-prompt-regression.test.mjs passed");
