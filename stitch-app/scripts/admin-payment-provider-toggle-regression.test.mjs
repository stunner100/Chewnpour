import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = async (relativePath) => fs.readFile(path.join(root, relativePath), "utf8");

const schemaSource = await read("convex/schema.ts");
const adminSource = await read("convex/admin.ts");
const subscriptionsSource = await read("convex/subscriptions.ts");
const adminDashboardSource = await read("src/pages/AdminDashboard.jsx");
const subscriptionPageSource = await read("src/pages/Subscription.jsx");
const envExampleSource = await read(".env.example");

for (const pattern of [
    'PAYMENT_PROVIDER_KEY = "paymentProvider"',
]) {
    if (!adminSource.includes(pattern)) {
        throw new Error(`Expected admin.ts to include "${pattern}".`);
    }
}

if (!schemaSource.includes('appSettings: defineTable({')) {
    throw new Error("Expected schema.ts to define appSettings table.");
}
if (!schemaSource.includes('index("by_key", ["key"])')) {
    throw new Error("Expected schema.ts to include appSettings.by_key index.");
}

for (const pattern of [
    "PAYMENT_PROVIDER_MANUAL",
    "setPaymentProvider",
    "getDashboardSnapshot",
    "paymentProviderConfig",
    "Manual (no API key)",
    "options: PAYMENT_PROVIDER_OPTIONS.map",
]) {
    if (!adminSource.includes(pattern)) {
        throw new Error(`Expected admin.ts to include "${pattern}".`);
    }
}

if (!adminSource.includes("requiresKey")) {
    throw new Error("Expected admin.ts to expose whether provider requires an API key.");
}

for (const pattern of [
    "const initializeManualCheckout",
    "PAYMENT_PROVIDER_MANUAL",
    "getPaymentProviderSettingInternal",
    "initializePayload.provider",
    "if (provider === PAYMENT_PROVIDER_MANUAL)",
    "ignored_provider",
    "buildFallbackCheckoutRedirect",
    "resolvePaymentProvider(initializedTransaction.provider)",
]) {
    if (!subscriptionsSource.includes(pattern)) {
        throw new Error(`Expected subscriptions.ts to include "${pattern}".`);
    }
}

if (!subscriptionsSource.includes("ctx.runQuery(\n            internal.subscriptions.getPaymentProviderSettingInternal,")) {
    throw new Error("Expected initializePaystackTopUpCheckout to resolve payment provider through an internal query.");
}

if (!subscriptionPageSource.includes("providerHint")) {
    throw new Error("Expected Subscription.jsx to pass provider hint for checkout copy.");
}
if (!subscriptionPageSource.includes("Redirecting to")) {
    throw new Error("Expected Subscription.jsx to update loading checkout message.");
}

if (!adminDashboardSource.includes("Payment Provider")) {
    throw new Error("Expected AdminDashboard to expose provider setting panel.");
}
if (!adminDashboardSource.includes("handleSavePaymentProvider")) {
    throw new Error("Expected AdminDashboard to include save handler for provider selection.");
}

if (!envExampleSource.includes("PAYMENT_PROVIDER=paystack")) {
    throw new Error("Expected .env.example to include PAYMENT_PROVIDER.");
}

console.log("admin-payment-provider-toggle-regression.test.mjs passed");
