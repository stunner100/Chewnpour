import fs from "node:fs";

const toastSource = fs.readFileSync(
  new URL("../src/components/Toast.jsx", import.meta.url),
  "utf8",
);
const disclosureSource = fs.readFileSync(
  new URL("../src/components/watermelon/WatermelonDisclosure.jsx", import.meta.url),
  "utf8",
);

if (!/const Toast = \(\{\s*message,\s*onClose/.test(toastSource)) {
  throw new Error("Toast must preserve the legacy message/onClose component API.");
}

if (!/if \(!message\) return null/.test(toastSource)) {
  throw new Error("Toast must render nothing when no legacy message is provided.");
}

if (!/role="alert"/.test(toastSource)) {
  throw new Error("Toast must keep alert semantics for legacy notifications.");
}

if (/<button[\s\S]*aria-expanded=\{isOpen\}[\s\S]*\{title\}/.test(disclosureSource)) {
  throw new Error("WatermelonDisclosure must not wrap arbitrary header content in a button.");
}

if (!/role="button"/.test(disclosureSource) || !/onKeyDown=/.test(disclosureSource)) {
  throw new Error("WatermelonDisclosure header must remain keyboard-toggleable.");
}

console.log("watermelon-ui-compat-regression.test.mjs passed");
