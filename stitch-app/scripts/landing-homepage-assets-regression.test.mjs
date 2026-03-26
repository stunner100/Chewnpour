import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const landingPagePath = path.join(root, "src", "pages", "LandingPage.jsx");
const assetPaths = [
  path.join(root, "public", "chewnpour", "img1.jpg"),
  path.join(root, "public", "chewnpour", "img2.jpg"),
  path.join(root, "public", "chewnpour", "img3.jpg"),
  path.join(root, "public", "chewnpour", "img4.jpg"),
];

const landingSource = await fs.readFile(landingPagePath, "utf8");
for (const assetRef of ["/chewnpour/img1.jpg", "/chewnpour/img2.jpg", "/chewnpour/img3.jpg", "/chewnpour/img4.jpg"]) {
  assert.equal(
    landingSource.includes(assetRef),
    true,
    `Expected LandingPage.jsx to reference ${assetRef}.`,
  );
}

for (const assetPath of assetPaths) {
  await fs.access(assetPath);
}

console.log("landing-homepage-assets-regression.test.mjs passed");
