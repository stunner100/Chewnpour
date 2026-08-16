export const LESSON_KINDS = ["narrative", "procedure", "concept", "argument"];

export const LESSON_KIND_SPINES = {
    narrative: [
        "Why This Matters",
        "Key Terms to Know First",
        "Who and When",
        "Causal Chain",
        "A Sourced Episode",
        "Competing Accounts",
        "What Changed After",
    ],
    procedure: [
        "Why This Matters",
        "Key Terms to Know First",
        "The Steps",
        "Worked Example",
        "Traps and Mistakes",
        "Use It",
        "Recap from Memory",
    ],
    concept: [
        "Why This Matters",
        "Key Terms to Know First",
        "The Idea",
        "Examples and Non-Examples",
        "The Attractive Wrong Idea",
        "Use It",
        "Recap from Memory",
    ],
    argument: [
        "Why This Matters",
        "The Claim",
        "Evidence from the Source",
        "The Counterargument",
        "How to Decide",
        "Recap from Memory",
    ],
};

const NARRATIVE_RE =
    /\b(history|historical|empire|war|reign|dynasty|revolution|century|timeline|biography|outbreak|treaty|kingdom|civilization|ancient|medieval|colonial|fragmentation|emperor|elector|napoleon|rome|roman)\b/i;
const ARGUMENT_RE =
    /\b(should we|should the|debate|versus|\bvs\.?\b|argument|ethics|ethical|policy|critique|pros and cons|claim that)\b/i;
const LEARNER_DOES_RE =
    /\b(how to|calculate|solve|install|configure|set up|balance the|write a|protocol|algorithm|workflow|procedure|step[- ]by[- ]step)\b/i;
const MECHANISM_RE =
    /\b(theory|principle|definition|what is|concept|model|photosynthesis|mitosis|atom|cell|mechanism|cycle of)\b/i;
const PROCESS_RE =
    /\b(first|then|next|finally|after|before|steps|sequence|process|pipeline|stage|stages|followed by)\b/i;

const countMatches = (regex, text) => {
    const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
    const matches = String(text || "").match(new RegExp(regex.source, flags));
    return matches ? matches.length : 0;
};

export const normalizeLessonKind = (value) => {
    const kind = String(value || "").trim().toLowerCase();
    return LESSON_KINDS.includes(kind) ? kind : null;
};

export const classifyLessonKind = ({ title = "", description = "", snippet = "" } = {}) => {
    const titleText = String(title || "");
    const hay = `${titleText} ${description || ""} ${String(snippet || "").slice(0, 900)}`;

    const narrativeScore =
        countMatches(NARRATIVE_RE, hay) + countMatches(NARRATIVE_RE, titleText) * 2;
    const argumentScore = countMatches(ARGUMENT_RE, hay) + countMatches(ARGUMENT_RE, titleText) * 2;
    const procedureScore =
        countMatches(LEARNER_DOES_RE, hay) * 2 + countMatches(PROCESS_RE, hay);
    const conceptScore = countMatches(MECHANISM_RE, hay);

    if (countMatches(ARGUMENT_RE, titleText) >= 1) return "argument";
    if (argumentScore >= 2 && argumentScore >= narrativeScore) return "argument";
    if (narrativeScore >= 2) return "narrative";
    if (narrativeScore >= 1 && procedureScore < 3 && argumentScore < 2) return "narrative";
    if (procedureScore >= 3 || countMatches(LEARNER_DOES_RE, hay) >= 1) return "procedure";
    if (conceptScore >= 1) return "concept";
    if (procedureScore >= 2) return "procedure";
    return "concept";
};

export const spineForLessonKind = (kind) => {
    const normalized = normalizeLessonKind(kind) || "concept";
    return [...LESSON_KIND_SPINES[normalized]];
};

export const promptBlockForLessonKind = (kind) => {
    const normalized = normalizeLessonKind(kind) || "concept";
    const titles = spineForLessonKind(normalized);
    const extra = {
        narrative:
            "Do not invent a Step-by-Step Breakdown, fake calculation, or generic Everyday Analogy. Causal Chain is causes and consequences from the source. A Sourced Episode is one concrete incident named in the source. Competing Accounts covers mix-ups or rival explanations in the source.",
        procedure:
            "Put the worked example immediately after the steps. The example must show the process, not a trivia fact. Traps and Mistakes are errors a learner would actually make. Do not add Everyday Analogy unless it maps a real step and you say where it breaks.",
        concept:
            "The Idea explains the concept in full paragraphs. Examples and Non-Examples must contrast. The Attractive Wrong Idea is a refutation: the myth, why it tempts, then the correct account. Skip Everyday Analogy unless it maps the concept and you state the limit.",
        argument:
            "Ground The Claim and Evidence in the source. The Counterargument must be a real opposing view from the source, not a straw man. How to Decide weighs the evidence. Do not force a procedure or timeline template.",
    };
    return [
        `This topic is a ${normalized} lesson. Do not use the same nine-section template as other topics.`,
        `Use exactly these H2 titles in this order: ${titles.join(", ")}.`,
        extra[normalized],
        "Each H2 needs real paragraphs grounded in the source. Do not shrink the lesson to bullets or three sentences.",
        "After those H2s, add ## Word Bank with 6-8 term: definition entries for later flashcards. Word Bank is not a teaching step.",
        "Do not write Quick Check Q/A pairs. Do not use Simple Introduction, Key Ideas in Plain English, Everyday Analogy, Practical Use Cases, or Summary unless they appear in the H2 list above.",
    ].join(" ");
};
