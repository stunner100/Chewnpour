import fs from "node:fs/promises";

const uploadSource = await fs.readFile(
  new URL("../src/pages/UploadMaterials.jsx", import.meta.url),
  "utf8"
);

if (uploadSource.includes("UPLOAD_CREDITS_EXHAUSTED") || uploadSource.includes("paywallMessage")) {
  throw new Error("UploadMaterials should not send users to a paywall.");
}

console.log("dashboard-upload-cta-flicker-regression.test.mjs passed");
