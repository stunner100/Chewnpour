"use node";

import { spawn } from "node:child_process";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type MarkItDownExtractResponse = {
    backend: "markitdown";
    markdown: string;
    text: string;
    warnings: string[];
};

const MARKITDOWN_PYTHON_BIN = String(process.env.MARKITDOWN_PYTHON_BIN || "python3").trim() || "python3";
const MARKITDOWN_TIMEOUT_MS = Number(process.env.MARKITDOWN_TIMEOUT_MS || 120000);
const MARKITDOWN_SCRIPT_PATH = fileURLToPath(new URL("../../scripts/markitdown_convert.py", import.meta.url));

const sanitizeOutput = (value: string) =>
    String(value || "")
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .trim();

const getTempInputPath = (fileName: string) => {
    const baseName = basename(String(fileName || "upload")).replace(/[^A-Za-z0-9._-]+/g, "-") || "upload";
    const extension = extname(baseName) || ".bin";
    return baseName.endsWith(extension) ? baseName : `${baseName}${extension}`;
};

export const callMarkItDownExtract = async (args: {
    fileName: string;
    fileBuffer: ArrayBuffer;
    timeoutMs?: number;
}): Promise<MarkItDownExtractResponse> => {
    const timeoutMs = Math.max(30000, Number(args.timeoutMs || MARKITDOWN_TIMEOUT_MS || 120000));
    const tempDir = await mkdtemp(join(tmpdir(), "stitch-markitdown-"));
    const inputPath = join(tempDir, getTempInputPath(args.fileName));

    try {
        await writeFile(inputPath, Buffer.from(args.fileBuffer));

        const child = spawn(MARKITDOWN_PYTHON_BIN, [MARKITDOWN_SCRIPT_PATH, inputPath], {
            stdio: ["ignore", "pipe", "pipe"],
        });

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let timedOut = false;

        const timeoutHandle = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, timeoutMs);

        const output = await new Promise<string>((resolve, reject) => {
            child.stdout.on("data", (chunk) => stdoutChunks.push(Buffer.from(chunk)));
            child.stderr.on("data", (chunk) => stderrChunks.push(Buffer.from(chunk)));
            child.on("error", reject);
            child.on("close", (code) => {
                clearTimeout(timeoutHandle);
                const stdout = Buffer.concat(stdoutChunks).toString("utf8");
                const stderr = Buffer.concat(stderrChunks).toString("utf8");

                if (timedOut) {
                    reject(new Error(`MarkItDown error: conversion timed out after ${timeoutMs}ms`));
                    return;
                }

                if (code !== 0) {
                    const details = sanitizeOutput(stderr || stdout);
                    reject(new Error(
                        details
                            ? `MarkItDown error: ${details}`
                            : `MarkItDown error: converter exited with code ${code}`
                    ));
                    return;
                }

                resolve(stdout);
            });
        });

        let parsed: any;
        try {
            parsed = JSON.parse(output);
        } catch (error) {
            throw new Error(
                `MarkItDown error: invalid JSON response (${error instanceof Error ? error.message : String(error)})`
            );
        }

        const markdown = sanitizeOutput(String(parsed?.markdown || parsed?.text || ""));
        if (!markdown) {
            throw new Error("MarkItDown error: conversion returned empty markdown");
        }

        const warnings = Array.isArray(parsed?.warnings)
            ? parsed.warnings.map((entry: unknown) => sanitizeOutput(String(entry || ""))).filter(Boolean)
            : [];

        return {
            backend: "markitdown",
            markdown,
            text: markdown,
            warnings,
        };
    } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
};
