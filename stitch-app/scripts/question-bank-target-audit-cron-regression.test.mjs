import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const cronsPath = path.join(root, "convex", "crons.ts");
const source = await fs.readFile(cronsPath, "utf8");

for (const expectedPattern of [
  'crons.interval(',
  '"question bank target audit"',
  '{ hours: 12 }',
  'internal.grounded.runStaleQuestionBankTargetAudit',
]) {
  if (!source.includes(expectedPattern)) {
    throw new Error(`Expected crons.ts to include "${expectedPattern}" for periodic target auditing.`);
  }
}

console.log("question-bank-target-audit-cron-regression.test.mjs passed");
