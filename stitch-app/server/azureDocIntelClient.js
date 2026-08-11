const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatAzureTable = (table) => {
    const cells = table?.cells || [];
    if (cells.length === 0) return "";

    const maxRow = Math.max(0, ...cells.map((cell) => Number(cell.rowIndex ?? 0)));
    const maxCol = Math.max(0, ...cells.map((cell) => Number(cell.columnIndex ?? 0)));
    const grid = Array.from({ length: maxRow + 1 }, () => Array(maxCol + 1).fill("-"));

    for (const cell of cells) {
        const row = Number(cell.rowIndex ?? 0);
        const col = Number(cell.columnIndex ?? 0);
        const text = String(cell.content || "")
            .replace(/\|/g, "/")
            .replace(/\n/g, " ")
            .trim();
        grid[row][col] = text || "-";
    }

    const tableLines = grid.map((row) => `| ${row.join(" | ")} |`);
    if (tableLines.length > 1) {
        const sep = `| ${grid[0].map(() => "---").join(" | ")} |`;
        tableLines.splice(1, 0, sep);
    }
    return tableLines.join("\n");
};

export const extractTextFromAzureResult = (result) => {
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

export const isAzureDocIntelEnabled = () => {
    const endpoint = String(process.env.AZURE_DOCINTEL_ENDPOINT || "").trim();
    const apiKey = String(process.env.AZURE_DOCINTEL_KEY || "").trim();
    return Boolean(endpoint && apiKey);
};

/**
 * OCR via Azure Document Intelligence prebuilt-layout.
 * Returns { text, skipped, reason?, backend, parser, pageCount }.
 */
export const callAzureDocIntelLayout = async ({
    fileBuffer,
    contentType = "application/pdf",
} = {}) => {
    const endpointBase = String(process.env.AZURE_DOCINTEL_ENDPOINT || "")
        .trim()
        .replace(/\/+$/, "");
    const apiKey = String(process.env.AZURE_DOCINTEL_KEY || "").trim();
    const apiVersion = String(
        process.env.AZURE_DOCINTEL_API_VERSION || "2023-07-31",
    ).trim();

    if (!endpointBase || !apiKey) {
        return {
            text: "",
            skipped: true,
            reason: "missing_azure_env",
            backend: "azure_docintel",
            parser: "prebuilt-layout",
            pageCount: null,
        };
    }

    const url =
        `${endpointBase}/formrecognizer/documentModels/prebuilt-layout:analyze` +
        `?api-version=${encodeURIComponent(apiVersion)}`;
    const analyzeResponse = await fetch(url, {
        method: "POST",
        headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
            "Content-Type": contentType || "application/pdf",
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

    const maxAttempts = Number(process.env.AZURE_DOCINTEL_MAX_POLLS || 30) || 30;
    const pollMs = Number(process.env.AZURE_DOCINTEL_POLL_MS || 2000) || 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await sleep(pollMs);
        const pollResponse = await fetch(operationLocation, {
            headers: { "Ocp-Apim-Subscription-Key": apiKey },
        });
        if (!pollResponse.ok) {
            const errText = await pollResponse.text();
            throw new Error(
                `Azure OCR polling error: ${pollResponse.status} - ${errText}`,
            );
        }
        const data = await pollResponse.json();
        const status = data?.status;
        if (status === "succeeded") {
            const pages = data?.analyzeResult?.pages || [];
            return {
                text: extractTextFromAzureResult(data),
                skipped: false,
                backend: "azure_docintel",
                parser: "prebuilt-layout",
                pageCount: Array.isArray(pages) ? pages.length : null,
            };
        }
        if (status === "failed") {
            throw new Error("Azure OCR failed");
        }
    }

    throw new Error("Azure OCR timed out");
};
