// The passages from the student's own notes that a tutor answer was grounded
// in, trimmed to short snippets the chat can show under the answer.
const MAX_SOURCES = 3;
const SNIPPET_CHARS = 240;

const toSnippet = (content) => {
    const text = String(content || "").replace(/\s+/g, " ").trim();
    if (text.length <= SNIPPET_CHARS) return text;
    const cut = text.slice(0, SNIPPET_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    return `${cut.slice(0, lastSpace > SNIPPET_CHARS * 0.6 ? lastSpace : SNIPPET_CHARS)}…`;
};

export const toTutorSources = (passages = []) =>
    (Array.isArray(passages) ? passages : [])
        .map((passage) => ({
            passageId: String(passage?.id || ""),
            chunkIndex: Number(passage?.chunkIndex || 0),
            snippet: toSnippet(passage?.content),
        }))
        .filter((source) => source.passageId && source.snippet)
        .slice(0, MAX_SOURCES);

export const readMessageSources = (row) =>
    Array.isArray(row?.sources) ? row.sources : [];
