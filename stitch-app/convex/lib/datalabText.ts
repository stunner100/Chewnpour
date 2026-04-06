"use node";

const HTML_ENTITY_MAP: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
};

const decodeHtmlEntity = (entity: string) => {
    const normalized = String(entity || "").trim().toLowerCase();
    if (!normalized) return "";
    if (normalized[0] === "#") {
        const isHex = normalized[1] === "x";
        const rawValue = normalized.slice(isHex ? 2 : 1);
        const parsed = Number.parseInt(rawValue, isHex ? 16 : 10);
        return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : `&${entity};`;
    }
    return HTML_ENTITY_MAP[normalized] ?? `&${entity};`;
};

const decodeHtmlEntities = (value: string) =>
    String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => decodeHtmlEntity(entity));

export const cleanDataLabBlockText = (value: string) => {
    const raw = String(value || "");
    if (!raw) return "";

    const tableAware = raw
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\s*\/p\s*>/gi, "\n\n")
        .replace(/<\s*\/div\s*>/gi, "\n")
        .replace(/<\s*\/li\s*>/gi, "\n")
        .replace(/<\s*li[^>]*>/gi, "- ")
        .replace(/<\s*\/tr\s*>/gi, "\n")
        .replace(/<\s*tr[^>]*>/gi, "")
        .replace(/<\s*\/t(?:d|h)\s*>/gi, " | ")
        .replace(/<\s*t(?:d|h)[^>]*>/gi, "")
        .replace(/<\s*\/?(?:thead|tbody|tfoot|table)[^>]*>/gi, "\n");

    return decodeHtmlEntities(tableAware)
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]*\|[ \t]*/g, " | ")
        .replace(/(?:\s*\|\s*){2,}/g, " | ")
        .replace(/^\s*\|\s*/gm, "")
        .replace(/\s*\|\s*$/gm, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
};
