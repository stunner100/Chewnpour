import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../src/components/magicui/Particles.jsx", import.meta.url),
  "utf8",
);

if (!/prefers-reduced-motion:\s*reduce/.test(source)) {
  throw new Error("Particles must check the prefers-reduced-motion media query.");
}

if (!/addEventListener\('change',\s*handleChange\)/.test(source)) {
  throw new Error("Particles must react when reduced-motion preference changes.");
}

if (!/if\s*\(\s*prefersReducedMotion\s*\)\s*{\s*return undefined;\s*}/.test(source)) {
  throw new Error("Particles animation effect must not start under reduced motion.");
}

if (!/if\s*\(\s*prefersReducedMotion\s*\)\s*{\s*return null;\s*}/.test(source)) {
  throw new Error("Particles must avoid rendering the decorative canvas under reduced motion.");
}

console.log("magicui-particles-reduced-motion-regression.test.mjs passed");
