import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");

const subscriptionPageSource = await read("src/pages/Subscription.jsx");
if (!subscriptionPageSource.includes('Navigate to="/dashboard"')) {
    throw new Error("Expected Subscription.jsx to redirect instead of running checkout.");
}

const billingHttp = await read("server/billingHttp.js");
if (!billingHttp.includes("BILLING_RETIRED")) {
    throw new Error("Expected billing checkout to be retired.");
}

console.log("admin-payment-provider-toggle-regression.test.mjs passed");
