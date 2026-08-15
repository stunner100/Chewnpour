// Grounding checks used to gate AI-generated quiz answers before they persist.
//
// The goal is to drop answers the model invented instead of drawing from the
// source. This is deliberately lenient: answers are often reworded, so we do
// not require a verbatim match. We accept a claim when either the normalized
// phrase appears in the source or the majority of its meaningful tokens do.
// A single stray token ("some") is exactly what lets hallucinated answers
// through, so one match is never enough on its own.

const normalizeForGrounding = (value) =>
    String(value || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const isTextGroundedInSource = (text, source, { minTokenRatio = 0.5 } = {}) => {
    const claim = normalizeForGrounding(text);
    const haystack = normalizeForGrounding(source);
    if (!claim) return false;
    // Fail open when there is no source to check against rather than dropping
    // every question on a missing extraction.
    if (!haystack) return true;
    if (haystack.includes(claim)) return true;
    const tokens = claim.split(" ").filter((token) => token.length >= 3);
    if (tokens.length === 0) return false;
    const matched = tokens.filter((token) => haystack.includes(token)).length;
    return matched / tokens.length >= minTokenRatio;
};
