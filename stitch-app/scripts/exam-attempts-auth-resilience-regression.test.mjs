import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const examsPath = path.join(root, "convex", "exams.ts");
const source = await fs.readFile(examsPath, "utf8");

if (!/export const getUserExamAttempts = query\(/.test(source)) {
  throw new Error("Expected getUserExamAttempts query to exist.");
}

const sectionStart = source.indexOf("export const getUserExamAttempts = query(");
const sectionEnd = source.indexOf("// Get exam attempts for a specific topic");
if (sectionStart === -1 || sectionEnd === -1 || sectionEnd <= sectionStart) {
  throw new Error("Expected getUserExamAttempts section boundaries to be detectable.");
}
const section = source.slice(sectionStart, sectionEnd);

if (!/if \(!authUserId\) return \[\];/.test(section)) {
  throw new Error(
    "Expected getUserExamAttempts to return an empty list when auth identity is not ready."
  );
}

if (!/const requestedUserId = typeof args\.userId === "string" \? args\.userId\.trim\(\) : "";/m.test(section)) {
  throw new Error(
    "Expected getUserExamAttempts to normalize optional requested userId safely."
  );
}

if (!/const effectiveUserId = requestedUserId && requestedUserId === authUserId\s*\?[\s\S]*:\s*authUserId;/m.test(section)) {
  throw new Error(
    "Expected getUserExamAttempts to use auth identity as source of truth when requested userId mismatches."
  );
}

if (/assertAuthorizedUser\(\{\s*authUserId,\s*requestedUserId:\s*args\.userId,\s*\}\)/m.test(section)) {
  throw new Error(
    "Expected getUserExamAttempts to avoid strict requested user assertion that can break during session races."
  );
}

console.log("exam-attempts-auth-resilience-regression.test.mjs passed");
