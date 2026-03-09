#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { spawnSync } from "node:child_process";

const MIN_EXTRACTED_TEXT_LENGTH = 200;
const DEFAULT_QWEN_OCR_MODEL = "qwen-vl-ocr";
const DEFAULT_QWEN_PROMPT =
  "Extract all visible text from this document image. Preserve reading order. " +
  "Return plain text only with line breaks. Do not add commentary or markdown.";
const MAX_COMPARISON_CHARS = 12000;
const ASSIGNMENT_DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".bmp",
  ".tif",
  ".tiff",
  ".gif",
]);

const usage = () => {
  console.log(`Usage:
  node scripts/ocr-ab-benchmark.mjs --file <path> [--file <path> ...]
  node scripts/ocr-ab-benchmark.mjs --dir <path> [--recursive]

Options:
  --file <path>         Add one file to benchmark (repeatable)
  --dir <path>          Add supported files from a directory
  --recursive           Recurse into subdirectories for --dir
  --truth-dir <path>    Directory containing ground-truth .txt files by basename
  --truth-map <path>    JSON file mapping absolute path or basename -> truth .txt path
  --out <path>          Output JSON report path (default: output/ocr-ab-report.json)
  --qwen-model <name>   Qwen OCR model (default: qwen-vl-ocr-latest)
  --qwen-prompt <text>  Prompt sent with OCR image
  --max-pdf-pages <n>   Max PDF pages to convert for Qwen OCR (default: 1)
  --help                Show this message

Env vars used:
  Azure: AZURE_DOCINTEL_ENDPOINT, AZURE_DOCINTEL_KEY, AZURE_DOCINTEL_API_VERSION
  Qwen:  QWEN_API_KEY, QWEN_BASE_URL (or INCEPTION_API_KEY / INCEPTION_BASE_URL fallback)

Examples:
  node scripts/ocr-ab-benchmark.mjs --file ./samples/receipt.png
  node scripts/ocr-ab-benchmark.mjs --dir ./samples --recursive --truth-dir ./samples/truth
`);
};

const parseArgValue = (raw) => {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const loadEnvFile = async (envPath) => {
  try {
    const source = await fs.readFile(envPath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (process.env[key] !== undefined) continue;
      const value = parseArgValue(trimmed.slice(eq + 1));
      process.env[key] = value;
    }
  } catch {
    // Optional env files.
  }
};

const loadEnv = async (cwd) => {
  await loadEnvFile(path.join(cwd, ".env.local"));
  await loadEnvFile(path.join(cwd, ".env"));
};

const parseArgs = (argv) => {
  const options = {
    files: [],
    dirs: [],
    recursive: false,
    truthDir: null,
    truthMapPath: null,
    outPath: path.resolve("output", "ocr-ab-report.json"),
    qwenModel: DEFAULT_QWEN_OCR_MODEL,
    qwenPrompt: DEFAULT_QWEN_PROMPT,
    maxPdfPages: 1,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--file") {
      if (!next) throw new Error("Missing value for --file");
      options.files.push(path.resolve(next));
      i += 1;
      continue;
    }
    if (arg === "--dir") {
      if (!next) throw new Error("Missing value for --dir");
      options.dirs.push(path.resolve(next));
      i += 1;
      continue;
    }
    if (arg === "--recursive") {
      options.recursive = true;
      continue;
    }
    if (arg === "--truth-dir") {
      if (!next) throw new Error("Missing value for --truth-dir");
      options.truthDir = path.resolve(next);
      i += 1;
      continue;
    }
    if (arg === "--truth-map") {
      if (!next) throw new Error("Missing value for --truth-map");
      options.truthMapPath = path.resolve(next);
      i += 1;
      continue;
    }
    if (arg === "--out") {
      if (!next) throw new Error("Missing value for --out");
      options.outPath = path.resolve(next);
      i += 1;
      continue;
    }
    if (arg === "--qwen-model") {
      if (!next) throw new Error("Missing value for --qwen-model");
      options.qwenModel = String(next).trim();
      i += 1;
      continue;
    }
    if (arg === "--qwen-prompt") {
      if (!next) throw new Error("Missing value for --qwen-prompt");
      options.qwenPrompt = String(next);
      i += 1;
      continue;
    }
    if (arg === "--max-pdf-pages") {
      if (!next) throw new Error("Missing value for --max-pdf-pages");
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error("--max-pdf-pages must be a positive integer");
      }
      options.maxPdfPages = Math.max(1, Math.floor(parsed));
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
};

const extensionFor = (filePath) => path.extname(filePath).toLowerCase();

const isSupportedPath = (filePath) => SUPPORTED_EXTENSIONS.has(extensionFor(filePath));

const collectFilesFromDir = async (dirPath, recursive) => {
  const results = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        const nested = await collectFilesFromDir(fullPath, recursive);
        results.push(...nested);
      }
      continue;
    }
    if (entry.isFile() && isSupportedPath(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
};

const detectContentType = (filePath) => {
  const ext = extensionFor(filePath);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") return ASSIGNMENT_DOCX_MIME;
  if (ext === ".pptx") return PPTX_MIME;
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".tif" || ext === ".tiff") return "image/tiff";
  return "application/octet-stream";
};

const decodeXmlEntities = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

const extractTextFromPptxXml = (xml) => {
  const paragraphs = [];
  const pRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pMatch;
  while ((pMatch = pRegex.exec(xml)) !== null) {
    const pContent = pMatch[1];
    const texts = [];
    const tRegex = /<a:t>([\s\S]*?)<\/a:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      const decoded = decodeXmlEntities(tMatch[1]);
      if (decoded.trim()) texts.push(decoded);
    }
    if (texts.length > 0) paragraphs.push(texts.join(""));
  }
  return paragraphs.join("\n").trim();
};

const extractTextFromPptxNative = async (fileBuffer) => {
  const { unzipSync } = await import("fflate");
  const unzipped = unzipSync(new Uint8Array(fileBuffer));
  const slideEntries = [];
  const notesEntries = [];

  for (const zipPath of Object.keys(unzipped)) {
    const slideMatch = zipPath.match(/^ppt\/slides\/slide(\d+)\.xml$/);
    if (slideMatch) {
      slideEntries.push({ index: Number(slideMatch[1]), content: unzipped[zipPath] });
    }
    const notesMatch = zipPath.match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/);
    if (notesMatch) {
      notesEntries.push({ index: Number(notesMatch[1]), content: unzipped[zipPath] });
    }
  }

  slideEntries.sort((a, b) => a.index - b.index);
  notesEntries.sort((a, b) => a.index - b.index);
  const decoder = new TextDecoder("utf-8");
  const allText = [];

  for (const slide of slideEntries) {
    const xml = decoder.decode(slide.content);
    const slideText = extractTextFromPptxXml(xml);
    if (slideText) allText.push(`--- Slide ${slide.index} ---\n${slideText}`);
  }
  for (const note of notesEntries) {
    const xml = decoder.decode(note.content);
    const noteText = extractTextFromPptxXml(xml);
    if (noteText) allText.push(`[Notes Slide ${note.index}] ${noteText}`);
  }

  return allText.join("\n\n").trim();
};

const extractTextFromPdfNative = async (fileBuffer) => {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(fileBuffer), { verbosity: 0 });
  try {
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text.trim() : "";
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatAzureTable = (table) => {
  const cells = table?.cells || [];
  if (cells.length === 0) return "";

  const maxRow = Math.max(0, ...cells.map((c) => Number(c.rowIndex ?? 0)));
  const maxCol = Math.max(0, ...cells.map((c) => Number(c.columnIndex ?? 0)));
  const grid = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill("-"));

  for (const cell of cells) {
    const r = Number(cell.rowIndex ?? 0);
    const c = Number(cell.columnIndex ?? 0);
    const text = String(cell.content || "").replace(/\|/g, "/").replace(/\n/g, " ").trim();
    grid[r][c] = text || "-";
  }

  const tableLines = grid.map((row) => `| ${row.join(" | ")} |`);
  if (tableLines.length > 1) {
    const sep = `| ${grid[0].map(() => "---").join(" | ")} |`;
    tableLines.splice(1, 0, sep);
  }
  return tableLines.join("\n");
};

const extractTextFromAzureResult = (result) => {
  const parts = [];
  const content = result?.analyzeResult?.content;
  if (typeof content === "string" && content.trim()) {
    parts.push(content.trim());
  } else {
    const lines = [];
    const pages = result?.analyzeResult?.pages || [];
    for (const page of pages) {
      for (const line of page?.lines || []) {
        if (typeof line?.content === "string") lines.push(line.content);
      }
    }
    if (lines.length > 0) parts.push(lines.join("\n"));
  }
  const tables = result?.analyzeResult?.tables || [];
  for (const table of tables) {
    const formatted = formatAzureTable(table);
    if (formatted) parts.push(`\n[Table]\n${formatted}`);
  }
  return parts.join("\n").trim();
};

const callAzureDocIntelLayout = async (fileBuffer, contentType) => {
  const endpointBase = String(process.env.AZURE_DOCINTEL_ENDPOINT || "").trim().replace(/\/+$/, "");
  const apiKey = String(process.env.AZURE_DOCINTEL_KEY || "").trim();
  const apiVersion = String(process.env.AZURE_DOCINTEL_API_VERSION || "2023-07-31").trim();
  if (!endpointBase || !apiKey) {
    return { text: "", skipped: true, reason: "missing_azure_env" };
  }

  const url = `${endpointBase}/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
  const analyzeResponse = await fetch(url, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
      "Content-Type": contentType,
    },
    body: Buffer.from(fileBuffer),
  });
  if (analyzeResponse.status !== 202) {
    const errText = await analyzeResponse.text();
    throw new Error(`Azure OCR error: ${analyzeResponse.status} - ${errText}`);
  }

  const operationLocation = analyzeResponse.headers.get("operation-location");
  if (!operationLocation) {
    throw new Error("Azure OCR error: missing operation-location");
  }

  const maxAttempts = 20;
  for (let i = 0; i < maxAttempts; i += 1) {
    await sleep(2000);
    const pollResponse = await fetch(operationLocation, {
      headers: { "Ocp-Apim-Subscription-Key": apiKey },
    });
    if (!pollResponse.ok) {
      const errText = await pollResponse.text();
      throw new Error(`Azure OCR polling error: ${pollResponse.status} - ${errText}`);
    }
    const data = await pollResponse.json();
    const status = data?.status;
    if (status === "succeeded") {
      return { text: extractTextFromAzureResult(data), skipped: false };
    }
    if (status === "failed") {
      throw new Error("Azure OCR failed");
    }
  }
  throw new Error("Azure OCR timed out");
};

const isImageMime = (mime) => mime.startsWith("image/");

const toDataUrl = (buffer, mime) => `data:${mime};base64,${Buffer.from(buffer).toString("base64")}`;

const getQwenConfig = () => {
  const apiKey = String(process.env.QWEN_API_KEY || process.env.INCEPTION_API_KEY || "").trim();
  const baseUrl = String(
    process.env.QWEN_BASE_URL || process.env.INCEPTION_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  )
    .trim()
    .replace(/\/+$/, "");
  return { apiKey, baseUrl };
};

const resolveMessageContentText = (content) => {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.text === "string") return entry.text;
        return "";
      })
      .filter(Boolean);
    return parts.join("\n").trim();
  }
  if (content && typeof content === "object" && typeof content.text === "string") {
    return String(content.text).trim();
  }
  return "";
};

const callQwenOcrForImage = async (imageBuffer, mime, model, prompt) => {
  const { apiKey, baseUrl } = getQwenConfig();
  if (!apiKey) {
    return {
      text: "",
      skipped: true,
      reason: "missing_qwen_api_key",
      usage: null,
      rawError: null,
    };
  }

  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: toDataUrl(imageBuffer, mime),
              min_pixels: 3136,
              max_pixels: 12845056,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  };

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen OCR API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = resolveMessageContentText(data?.choices?.[0]?.message?.content);
  return {
    text,
    skipped: false,
    usage: data?.usage ?? null,
    rawError: null,
  };
};

const hasCommand = (commandName) => {
  const result = spawnSync("which", [commandName], { encoding: "utf8" });
  return result.status === 0 && String(result.stdout || "").trim().length > 0;
};

const convertPdfPagesToPng = async (pdfPath, maxPages) => {
  if (!hasCommand("pdftoppm")) {
    return { files: [], skipped: true, reason: "missing_pdftoppm" };
  }

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ocr-ab-"));
  const outFiles = [];
  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const prefix = path.join(tmpRoot, `page-${page}`);
      const result = spawnSync(
        "pdftoppm",
        ["-f", String(page), "-l", String(page), "-png", "-singlefile", pdfPath, prefix],
        { encoding: "utf8" }
      );
      if (result.status !== 0) {
        if (page === 1) {
          throw new Error(
            `pdftoppm failed: ${String(result.stderr || result.stdout || "unknown error").trim()}`
          );
        }
        break;
      }
      const pagePath = `${prefix}.png`;
      try {
        await fs.access(pagePath);
      } catch {
        if (page === 1) throw new Error("pdftoppm did not emit page-1 PNG");
        break;
      }
      outFiles.push(pagePath);
    }
    return { files: outFiles, skipped: outFiles.length === 0, reason: outFiles.length === 0 ? "no_pages" : null };
  } catch (error) {
    return {
      files: [],
      skipped: true,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
};

const removeDirSafe = async (targetPath) => {
  if (!targetPath) return;
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
};

const runCurrentExtractor = async (filePath, fileBuffer, contentType) => {
  const ext = extensionFor(filePath);
  const nativeStart = Date.now();
  let nativeText = "";
  let nativeStage = "none";
  let nativeError = null;

  if (ext === ".pdf") {
    try {
      nativeText = await extractTextFromPdfNative(fileBuffer);
      nativeStage = "native_pdf";
    } catch (error) {
      nativeError = error instanceof Error ? error.message : String(error);
    }
  } else if (ext === ".pptx") {
    try {
      nativeText = await extractTextFromPptxNative(fileBuffer);
      nativeStage = "native_pptx";
    } catch (error) {
      nativeError = error instanceof Error ? error.message : String(error);
    }
  }
  const nativeLatencyMs = Date.now() - nativeStart;

  if (nativeText.trim().length >= MIN_EXTRACTED_TEXT_LENGTH) {
    return {
      method: nativeStage,
      text: nativeText.trim(),
      latencyMs: nativeLatencyMs,
      nativeError,
      azureSkipped: true,
      azureError: null,
    };
  }

  const azureStart = Date.now();
  try {
    const azure = await callAzureDocIntelLayout(fileBuffer, contentType);
    const azureText = String(azure.text || "").trim();
    return {
      method: azureText.length > 0 ? "azure_layout" : "none",
      text: azureText,
      latencyMs: nativeLatencyMs + (Date.now() - azureStart),
      nativeError,
      azureSkipped: Boolean(azure.skipped),
      azureError: null,
    };
  } catch (error) {
    return {
      method: "none",
      text: nativeText.trim(),
      latencyMs: nativeLatencyMs + (Date.now() - azureStart),
      nativeError,
      azureSkipped: false,
      azureError: error instanceof Error ? error.message : String(error),
    };
  }
};

const runQwenExtractor = async (filePath, fileBuffer, contentType, options) => {
  const ext = extensionFor(filePath);
  const start = Date.now();
  let totalUsage = {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  const addUsage = (usage) => {
    if (!usage || typeof usage !== "object") return;
    totalUsage = {
      prompt_tokens: totalUsage.prompt_tokens + Number(usage.prompt_tokens || 0),
      completion_tokens: totalUsage.completion_tokens + Number(usage.completion_tokens || 0),
      total_tokens: totalUsage.total_tokens + Number(usage.total_tokens || 0),
    };
  };

  try {
    if (isImageMime(contentType)) {
      const result = await callQwenOcrForImage(fileBuffer, contentType, options.qwenModel, options.qwenPrompt);
      addUsage(result.usage);
      return {
        status: result.skipped ? "skipped" : "ok",
        reason: result.reason || null,
        text: result.text || "",
        latencyMs: Date.now() - start,
        usage: result.skipped ? null : totalUsage,
      };
    }

    if (ext === ".pdf") {
      const conversion = await convertPdfPagesToPng(filePath, options.maxPdfPages);
      if (conversion.skipped) {
        return {
          status: "skipped",
          reason: conversion.reason || "pdf_conversion_failed",
          text: "",
          latencyMs: Date.now() - start,
          usage: null,
        };
      }

      const pageTexts = [];
      const tmpRoot = conversion.files.length > 0 ? path.dirname(conversion.files[0]) : null;
      try {
        for (let i = 0; i < conversion.files.length; i += 1) {
          const pngPath = conversion.files[i];
          const pngBuffer = await fs.readFile(pngPath);
          const result = await callQwenOcrForImage(
            pngBuffer,
            "image/png",
            options.qwenModel,
            options.qwenPrompt
          );
          addUsage(result.usage);
          const text = String(result.text || "").trim();
          if (text) {
            pageTexts.push(`[Page ${i + 1}]\n${text}`);
          }
        }
      } finally {
        await removeDirSafe(tmpRoot);
      }

      return {
        status: "ok",
        reason: null,
        text: pageTexts.join("\n\n").trim(),
        latencyMs: Date.now() - start,
        usage: totalUsage,
      };
    }

    return {
      status: "skipped",
      reason: "unsupported_for_qwen_ocr_without_rendering",
      text: "",
      latencyMs: Date.now() - start,
      usage: null,
    };
  } catch (error) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message : String(error),
      text: "",
      latencyMs: Date.now() - start,
      usage: null,
    };
  }
};

const normalizeForComparison = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

const levenshteinDistance = (a, b) => {
  const aa = a.length;
  const bb = b.length;
  if (aa === 0) return bb;
  if (bb === 0) return aa;
  const prev = new Array(bb + 1);
  const curr = new Array(bb + 1);
  for (let j = 0; j <= bb; j += 1) prev[j] = j;
  for (let i = 1; i <= aa; i += 1) {
    curr[0] = i;
    const chA = a.charCodeAt(i - 1);
    for (let j = 1; j <= bb; j += 1) {
      const cost = chA === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= bb; j += 1) prev[j] = curr[j];
  }
  return prev[bb];
};

const computeSetF1 = (truthNorm, candidateNorm) => {
  const truthWords = new Set(truthNorm.split(/\W+/).filter(Boolean));
  const candWords = new Set(candidateNorm.split(/\W+/).filter(Boolean));
  if (truthWords.size === 0 && candWords.size === 0) return 1;
  if (truthWords.size === 0 || candWords.size === 0) return 0;

  let intersection = 0;
  for (const w of truthWords) {
    if (candWords.has(w)) intersection += 1;
  }
  const precision = intersection / candWords.size;
  const recall = intersection / truthWords.size;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
};

const computeTruthMetrics = (truthText, candidateText) => {
  const truthNormFull = normalizeForComparison(truthText);
  const candidateNormFull = normalizeForComparison(candidateText);
  const truthNorm = truthNormFull.slice(0, MAX_COMPARISON_CHARS);
  const candidateNorm = candidateNormFull.slice(0, MAX_COMPARISON_CHARS);
  const truncated =
    truthNormFull.length > MAX_COMPARISON_CHARS || candidateNormFull.length > MAX_COMPARISON_CHARS;
  const distance = levenshteinDistance(truthNorm, candidateNorm);
  const denominator = Math.max(1, truthNorm.length, candidateNorm.length);
  const similarity = 1 - distance / denominator;
  const cer = truthNorm.length > 0 ? distance / truthNorm.length : 0;
  const wordSetF1 = computeSetF1(truthNorm, candidateNorm);
  return {
    similarity: Number(similarity.toFixed(4)),
    cer: Number(cer.toFixed(4)),
    wordSetF1: Number(wordSetF1.toFixed(4)),
    truncated,
  };
};

const readTruthMap = async (truthMapPath) => {
  if (!truthMapPath) return {};
  const source = await fs.readFile(truthMapPath, "utf8");
  const parsed = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--truth-map must be a JSON object");
  }
  return parsed;
};

const resolveTruthPath = (filePath, truthDir, truthMap) => {
  const byAbs = truthMap[filePath];
  if (typeof byAbs === "string" && byAbs.trim()) return path.resolve(byAbs);
  const base = path.basename(filePath);
  const byBase = truthMap[base];
  if (typeof byBase === "string" && byBase.trim()) return path.resolve(byBase);
  if (!truthDir) return null;
  const stem = base.replace(/\.[^.]+$/, "");
  return path.join(truthDir, `${stem}.txt`);
};

const pickWinner = (currentMetrics, qwenMetrics) => {
  if (!currentMetrics && !qwenMetrics) return "no_ground_truth";
  if (!currentMetrics) return "qwen";
  if (!qwenMetrics) return "current";
  if (currentMetrics.similarity > qwenMetrics.similarity) return "current";
  if (qwenMetrics.similarity > currentMetrics.similarity) return "qwen";
  return "tie";
};

const ensureDirForFile = async (targetPath) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
};

const main = async () => {
  const cwd = process.cwd();
  await loadEnv(cwd);
  const options = parseArgs(process.argv.slice(2));

  const discoveredFiles = [...options.files];
  for (const dirPath of options.dirs) {
    const fromDir = await collectFilesFromDir(dirPath, options.recursive);
    discoveredFiles.push(...fromDir);
  }

  const uniqueFiles = Array.from(new Set(discoveredFiles)).filter((candidate) =>
    isSupportedPath(candidate)
  );
  if (uniqueFiles.length === 0) {
    usage();
    throw new Error("No supported files found. Pass --file or --dir with supported extensions.");
  }

  const truthMap = await readTruthMap(options.truthMapPath);
  const results = [];
  let comparedWithTruth = 0;

  for (let i = 0; i < uniqueFiles.length; i += 1) {
    const filePath = uniqueFiles[i];
    const contentType = detectContentType(filePath);
    const fileBuffer = await fs.readFile(filePath);

    const current = await runCurrentExtractor(filePath, fileBuffer, contentType);
    const qwen = await runQwenExtractor(filePath, fileBuffer, contentType, options);

    const truthPath = resolveTruthPath(filePath, options.truthDir, truthMap);
    let truthText = null;
    let truthError = null;
    if (truthPath) {
      try {
        truthText = await fs.readFile(truthPath, "utf8");
      } catch (error) {
        truthError = error instanceof Error ? error.message : String(error);
      }
    }

    const currentMetrics = truthText !== null ? computeTruthMetrics(truthText, current.text) : null;
    const qwenMetrics =
      truthText !== null && qwen.status === "ok" ? computeTruthMetrics(truthText, qwen.text) : null;
    if (truthText !== null) comparedWithTruth += 1;

    const winner = pickWinner(currentMetrics, qwenMetrics);

    const record = {
      filePath,
      contentType,
      fileSizeBytes: fileBuffer.byteLength,
      current: {
        method: current.method,
        chars: String(current.text || "").length,
        latencyMs: current.latencyMs,
        nativeError: current.nativeError,
        azureError: current.azureError,
      },
      qwen: {
        status: qwen.status,
        reason: qwen.reason,
        chars: String(qwen.text || "").length,
        latencyMs: qwen.latencyMs,
        usage: qwen.usage,
      },
      truth: truthPath
        ? {
            path: truthPath,
            chars: truthText ? truthText.length : 0,
            readError: truthError,
          }
        : null,
      metrics: {
        current: currentMetrics,
        qwen: qwenMetrics,
        winner,
      },
      samples: {
        currentPreview: String(current.text || "").slice(0, 240),
        qwenPreview: String(qwen.text || "").slice(0, 240),
      },
    };
    results.push(record);

    console.log(
      `[${i + 1}/${uniqueFiles.length}] ${path.basename(filePath)} | current=${record.current.method}:${record.current.chars}c/${record.current.latencyMs}ms | qwen=${record.qwen.status}:${record.qwen.chars}c/${record.qwen.latencyMs}ms | winner=${winner}`
    );
  }

  const qwenOk = results.filter((r) => r.qwen.status === "ok");
  const summary = {
    files: results.length,
    withTruth: comparedWithTruth,
    qwenOk: qwenOk.length,
    qwenSkipped: results.filter((r) => r.qwen.status === "skipped").length,
    qwenErrors: results.filter((r) => r.qwen.status === "error").length,
    winners: {
      current: results.filter((r) => r.metrics.winner === "current").length,
      qwen: results.filter((r) => r.metrics.winner === "qwen").length,
      tie: results.filter((r) => r.metrics.winner === "tie").length,
      no_ground_truth: results.filter((r) => r.metrics.winner === "no_ground_truth").length,
    },
    averageLatencyMs: {
      current:
        results.length > 0
          ? Number(
              (
                results.reduce((acc, r) => acc + Number(r.current.latencyMs || 0), 0) / results.length
              ).toFixed(2)
            )
          : 0,
      qwen:
        qwenOk.length > 0
          ? Number(
              (qwenOk.reduce((acc, r) => acc + Number(r.qwen.latencyMs || 0), 0) / qwenOk.length).toFixed(2)
            )
          : 0,
    },
  };

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      qwenModel: options.qwenModel,
      maxPdfPages: options.maxPdfPages,
      minExtractedTextLength: MIN_EXTRACTED_TEXT_LENGTH,
      maxComparisonChars: MAX_COMPARISON_CHARS,
    },
    envInfo: {
      azureConfigured: Boolean(
        String(process.env.AZURE_DOCINTEL_ENDPOINT || "").trim() &&
          String(process.env.AZURE_DOCINTEL_KEY || "").trim()
      ),
      qwenConfigured: Boolean(
        String(process.env.QWEN_API_KEY || process.env.INCEPTION_API_KEY || "").trim()
      ),
      qwenBaseUrl:
        String(process.env.QWEN_BASE_URL || process.env.INCEPTION_BASE_URL || "").trim() || null,
    },
    summary,
    results,
  };

  await ensureDirForFile(options.outPath);
  await fs.writeFile(options.outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved OCR benchmark report to ${options.outPath}`);
};

main().catch((error) => {
  console.error(`OCR benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
