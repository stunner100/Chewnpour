const WORD_BANK_MAX = 8;

const GENERIC_MEANING_PATTERNS = [
  /important ideas? used in this topic/i,
  /important ideas? in this topic/i,
  /one of the important/i,
  /used in this topic/i,
  /explained in clear words/i,
];

const LEARNING_OBJECTIVE_TERM_PATTERN =
  /^(?:analy[sz]e|address(?:ing)?|apply|compare|concerns?|connect|define|describe|discuss|evaluate|explain|identify|learn|read|review|summari[sz]e|understand|use)\b/i;

const STOP_TERMS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
]);

const TERM_LEAD_VERBS = [
  "are",
  "becomes",
  "captures",
  "contains",
  "connects",
  "describes",
  "enables",
  "evaluates",
  "explains",
  "identifies",
  "includes",
  "is",
  "means",
  "measures",
  "moves",
  "provides",
  "records",
  "reduces",
  "refers",
  "represents",
  "requires",
  "sends",
  "shows",
  "stores",
  "supports",
  "tracks",
  "uses",
];

const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/[`*_#>[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const countWords = (value) => {
  const words = normalizeWhitespace(value).match(/[A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)*/g);
  return words ? words.length : 0;
};

const trimWords = (value, maxWords) => {
  const words = normalizeWhitespace(value).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ").replace(/[,:;–—-]\s*$/g, "").trim();
};

const normalizeSentence = (value, maxWords = 28) => {
  const trimmed = trimWords(value, maxWords)
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s*[;:]\s*$/g, "")
    .trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const normalizeTerm = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/^(?:[-*]|\d+[.)])\s+/, "")
    .replace(/\s*(?:[—–-]|:)\s+.*$/g, "")
    .replace(/[^A-Za-z0-9\s\-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = normalized.split(/\s+/).filter(Boolean).slice(0, 5);
  while (words.length > 0 && STOP_TERMS.has(words[0].toLowerCase())) {
    words.shift();
  }
  while (words.length > 0 && STOP_TERMS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(" ").trim();
};

const isUsableTerm = (term) => {
  const normalized = normalizeTerm(term);
  const wordCount = countWords(normalized);
  if (wordCount < 1 || wordCount > 5) return false;
  if (LEARNING_OBJECTIVE_TERM_PATTERN.test(normalized)) return false;
  if (STOP_TERMS.has(normalized.toLowerCase())) return false;
  if (/\b(?:to|and|or|for|from|with|about|into|through|by)$/i.test(normalized)) return false;
  return true;
};

const isUsableMeaning = (meaning) => {
  const normalized = normalizeSentence(meaning, 28);
  const wordCount = countWords(normalized);
  if (wordCount < 4 || wordCount > 28) return false;
  return !GENERIC_MEANING_PATTERNS.some((pattern) => pattern.test(normalized));
};

const splitSentences = (value) => {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeSentence(sentence, 36))
    .filter((sentence) => countWords(sentence) >= 4);
};

const collectSourceText = (args) => {
  const graph = args.contentGraph || {};
  const passages = Array.isArray(graph.sourcePassages)
    ? graph.sourcePassages.map((passage) => passage?.text || "")
    : [];
  return [
    args.topicContext,
    args.description,
    ...(Array.isArray(args.keyPoints) ? args.keyPoints : []),
    ...(Array.isArray(graph.keyPoints) ? graph.keyPoints : []),
    ...(Array.isArray(graph.subtopics) ? graph.subtopics : []),
    ...(Array.isArray(graph.examples) ? graph.examples : []),
    ...passages,
  ]
    .filter(Boolean)
    .join(" ");
};

const findMeaningForTerm = (term, sourceSentences) => {
  const escaped = normalizeTerm(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return "";
  const termPattern = new RegExp(`\\b${escaped}\\b`, "i");
  return sourceSentences.find((sentence) => termPattern.test(sentence)) || "";
};

const extractLeadTermFromSentence = (sentence) => {
  const verbAlternation = TERM_LEAD_VERBS.join("|");
  const match = normalizeWhitespace(sentence).match(
    new RegExp(`^([A-Za-z0-9][A-Za-z0-9\\-/]*(?:\\s+[A-Za-z0-9][A-Za-z0-9\\-/]*){0,4})\\s+(?:${verbAlternation})\\b`, "i"),
  );
  return match ? normalizeTerm(match[1]) : "";
};

const extractCapitalizedTerms = (sourceText) => {
  const terms = [];
  const matches = normalizeWhitespace(sourceText).matchAll(
    /\b[A-Z][A-Za-z0-9]*(?:[-/][A-Za-z0-9]+)?(?:\s+[A-Z][A-Za-z0-9]*(?:[-/][A-Za-z0-9]+)?){0,4}\b/g,
  );
  for (const match of matches) {
    terms.push(match[0]);
  }
  return terms;
};

const pushEntry = (entries, seen, termRaw, meaningRaw) => {
  const term = normalizeTerm(termRaw);
  const meaning = normalizeSentence(meaningRaw, 28);
  const key = term.toLowerCase();
  if (!isUsableTerm(term) || !isUsableMeaning(meaning) || seen.has(key)) return;
  seen.add(key);
  entries.push({ term, meaning });
};

export const deriveSourceGroundedWordBank = (args = {}) => {
  const sourceText = collectSourceText(args);
  const sourceSentences = splitSentences(sourceText);
  const graph = args.contentGraph || {};
  const entries = [];
  const seen = new Set();

  const existingDefinitions = [
    ...(Array.isArray(args.existingDefinitions) ? args.existingDefinitions : []),
    ...(Array.isArray(graph.definitions) ? graph.definitions : []),
  ];
  for (const definition of existingDefinitions) {
    pushEntry(
      entries,
      seen,
      definition?.term ?? definition?.word ?? definition?.name,
      definition?.meaning ?? definition?.definition ?? definition?.explanation,
    );
  }

  const candidateTerms = [
    ...(Array.isArray(graph.subtopics) ? graph.subtopics : []),
    ...(Array.isArray(args.keyPoints) ? args.keyPoints.map(extractLeadTermFromSentence) : []),
    ...(Array.isArray(graph.keyPoints) ? graph.keyPoints.map(extractLeadTermFromSentence) : []),
    ...sourceSentences.map(extractLeadTermFromSentence),
    ...extractCapitalizedTerms(sourceText),
  ].filter(Boolean);

  for (const candidate of candidateTerms) {
    if (entries.length >= (args.limit || WORD_BANK_MAX)) break;
    const term = normalizeTerm(candidate);
    const meaning = findMeaningForTerm(term, sourceSentences);
    pushEntry(entries, seen, term, meaning);
  }

  return entries.slice(0, args.limit || WORD_BANK_MAX);
};

