import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const protectedRoutePath = path.join(root, "src", "components", "ProtectedRoute.jsx");
const protectedRouteSource = await fs.readFile(protectedRoutePath, "utf8");

if (!protectedRouteSource.includes("if (loadingTimedOut && user) {")) {
  throw new Error("ProtectedRoute must unblock authenticated users after the loading timeout.");
}

if (!protectedRouteSource.includes("return children;")) {
  throw new Error("ProtectedRoute timeout fallback must render the protected content.");
}

if (!protectedRouteSource.includes("if (loadingTimedOut && isOnboardingRoute && !user) {")) {
  throw new Error("ProtectedRoute must still redirect unauthenticated onboarding routes after timeout.");
}

console.log("protected-route-profile-timeout-regression.test.mjs passed");
