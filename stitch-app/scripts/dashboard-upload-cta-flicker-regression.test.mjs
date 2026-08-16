import fs from "node:fs/promises";

const heroSource = await fs.readFile(
  new URL("../src/components/dashboard/DashboardHero.jsx", import.meta.url),
  "utf8"
);
const uploadSource = await fs.readFile(
  new URL("../src/pages/UploadMaterials.jsx", import.meta.url),
  "utf8"
);

if (heroSource.includes("Top up") || heroSource.includes("uploads remaining")) {
  throw new Error("DashboardHero should not show an upload credit meter.");
}

if (uploadSource.includes("UPLOAD_CREDITS_EXHAUSTED") || uploadSource.includes("paywallMessage")) {
  throw new Error("UploadMaterials should not send users to a paywall.");
}

console.log("dashboard-upload-cta-flicker-regression.test.mjs passed");
