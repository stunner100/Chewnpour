import fs from "node:fs/promises";

const dashboardSource = await fs.readFile(
  new URL("../src/pages/DashboardAnalysis.jsx", import.meta.url),
  "utf8"
);

for (const pattern of [
  "const normalizedRemaining = Number(remaining);",
  "!Number.isFinite(normalizedRemaining) || normalizedRemaining > 1 || !profile",
  "remaining={uploadQuota?.remaining}",
]) {
  if (!dashboardSource.includes(pattern)) {
    throw new Error(`Expected DashboardAnalysis.jsx to include \"${pattern}\" to prevent upload CTA flicker.`);
  }
}

if (dashboardSource.includes("remaining={uploadQuota?.remaining ?? 0}")) {
  throw new Error("DashboardAnalysis.jsx should not coerce unresolved upload quota to 0.");
}

console.log("dashboard-upload-cta-flicker-regression.test.mjs passed");
