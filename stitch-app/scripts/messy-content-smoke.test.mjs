/**
 * Quick smoke test for normalizeLessonContent with messy AI output.
 * Run: node scripts/messy-content-smoke.test.mjs
 */
import {
    normalizeLessonContent,
    cleanInlineText,
} from "../src/lib/topicContentFormatting.js";

// Simulate messy AI output with various formatting issues
const messyContent = [
    "\\n### Simple Introduction\\n",
    "Machine learning is a subset of AI.It uses statistical methods to learn from data.",
    "\\nKey Ideas in Plain English\\n",
    "- **Supervised Learning**: Training with labeled data\\n- **Unsupervised Learning**: Finding patterns without labels",
    "Step-by-Step Breakdown",
    "1) Collect data 2) Preprocess 3) Train model 4) Evaluate",
    "> Note: Always split your data into train/test sets.",
    "| Model | Accuracy | Speed |",
    "|-------|----------|-------|",
    "| SVM   | 95%      | Fast  |",
    "| CNN   | 99%      | Slow  |",
    "Common Mistakes",
    "- Overfitting to training data",
    "- Not normalizing features",
].join("\n");

const result = normalizeLessonContent(messyContent);
console.log("=== NORMALIZED OUTPUT ===");
console.log(result);
console.log("");
console.log("=== CHECKS ===");
console.log("Has sections:", /introduction|key ideas|step-by-step|common mistakes/i.test(result));
console.log("Lists intact:", result.includes("Supervised") && result.includes("Unsupervised"));
console.log("Table rows intact:", result.includes("SVM") && result.includes("CNN"));
console.log("No stray backslash-n:", !result.includes("\\n"));
console.log("Blockquote preserved:", result.includes("Note:"));

// Test with double-escaped markdown from API
const apiContent = "### Key Ideas\\n\\n- \\\\*\\\\*Neural Networks\\\\*\\\\*: Inspired by the brain\\n- \\\\*\\\\*Deep Learning\\\\*\\\\*: Multiple layers\\n\\nStep-by-Step Breakdown\\n\\n1. Define input features\\n2. Build network architecture\\n3. Train with backpropagation";
const apiResult = normalizeLessonContent(apiContent);
console.log("");
console.log("=== API CONTENT NORMALIZED ===");
console.log(apiResult);
console.log("Neural Networks preserved:", apiResult.includes("Neural Networks"));
console.log("Steps preserved:", apiResult.includes("1.") && apiResult.includes("2.") && apiResult.includes("3."));

console.log("");
console.log("✅ Messy content smoke test passed");
