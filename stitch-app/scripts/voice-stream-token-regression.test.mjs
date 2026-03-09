import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = await fs.readFile(path.join(root, "convex/lib/voiceStreamToken.ts"), "utf8");

const requiredPatterns = [
  "const BASE64_URL_ALPHABET =",
  "const decodeBase64UrlChar =",
  "const bytesToBase64Url = (bytes: Uint8Array) => {",
  "const base64UrlToBytes = (value: string) => {",
  "if (normalized.length % 4 === 1)",
  "\"A\".repeat(padLength)",
];

for (const pattern of requiredPatterns) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected voiceStreamToken.ts to include \"${pattern}\".`);
  }
}

for (const forbiddenPattern of ["btoa(", "atob("]) {
  if (source.includes(forbiddenPattern)) {
    throw new Error(`voiceStreamToken.ts should not include \"${forbiddenPattern}\".`);
  }
}

console.log("voice-stream-token-regression.test.mjs passed");
