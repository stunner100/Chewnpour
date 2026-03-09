"use node";

import type { RetrievedEvidence } from "./groundedRetrieval";

export type GroundedCitation = {
    passageId: string;
    page: number;
    startChar: number;
    endChar: number;
    quote: string;
};

export type GroundedMcqCandidate = {
    questionText: string;
    options: Array<{ label: string; text: string; isCorrect: boolean }>;
    explanation?: string;
    difficulty?: string;
    citations: GroundedCitation[];
    learningObjective?: string;
};

export type GroundedEssayCandidate = {
    questionText: string;
    correctAnswer: string;
    explanation?: string;
    difficulty?: string;
    citations: GroundedCitation[];
    rubricPoints?: string[];
    learningObjective?: string;
};

export type GroundedConceptCandidate = {
    questionText: string;
    template: string[];
    answers: string[];
    tokens: string[];
    citations: GroundedCitation[];
};

const formatEvidence = (evidence: RetrievedEvidence[], maxChars = 12000) => {
    const lines = evidence.map((entry, index) => {
        const trimmed = String(entry.text || "").slice(0, 900).trim();
        return [
            `EVIDENCE_${index + 1}:`,
            `passageId=${entry.passageId}; page=${entry.page}; start=${entry.startChar}; end=${entry.endChar}`,
            `"""${trimmed}"""`,
        ].join("\n");
    });
    return lines.join("\n\n").slice(0, maxChars);
};

export const buildGroundedMcqPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
    existingQuestionSample?: string;
}) => {
    const existingBlock = args.existingQuestionSample
        ? `\nExisting questions to avoid:\n${args.existingQuestionSample}`
        : "";

    return `Create ${args.requestedCount} multiple-choice questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence)}
${existingBlock}

Rules:
- Each question must be answerable only from evidence above.
- Every question must include citations[] with 1-3 citation objects.
- Every citation object must include: passageId, page, startChar, endChar, quote.
- quote must be an exact short excerpt from the cited passage.
- Use exactly 4 options with one correct answer.
- The marked correct option must be directly supported by the cited evidence.
- If the correct option includes a number, percentage, threshold, rate, count, or limit, copy that value exactly from evidence.
- Do not invent targets, definitions, or thresholds that are not explicitly stated in the evidence.
- Keep the correct option wording very close to the evidence. Do not add extra explanation inside the option text.
- For target/count/percentage questions, prefer short exact answers like "20% weekly" or "10 new vendors per week".
- For definition questions, prefer the shortest evidence-backed definition that still remains clear.
- Avoid near-duplicate questions.

Return JSON only:
{
  "questions": [
    {
      "questionText": "...",
      "options": [
        {"label":"A","text":"...","isCorrect":false},
        {"label":"B","text":"...","isCorrect":true},
        {"label":"C","text":"...","isCorrect":false},
        {"label":"D","text":"...","isCorrect":false}
      ],
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "learningObjective": "...",
      "citations": [
        {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
      ]
    }
  ]
}`;
};

export const buildGroundedMcqRepairPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    evidence: RetrievedEvidence[];
    candidate: any;
    repairReasons?: string[];
}) => `Repair the multiple-choice question below so it is strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 10000)}

REPAIR REASONS:
${Array.isArray(args.repairReasons) && args.repairReasons.length > 0
        ? args.repairReasons.map((reason) => `- ${reason}`).join("\n")
        : "- Candidate must remain fully supported by evidence."}

CANDIDATE JSON:
${JSON.stringify(args.candidate, null, 2)}

Rules:
- Keep the same question intent only if it is fully supported by the evidence.
- If the current question intent is not supported, rewrite the question so it matches the evidence exactly.
- Use exactly 4 options with one correct answer.
- The marked correct option must be directly supported by the cited evidence.
- If the correct option includes a number, percentage, threshold, rate, count, or limit, copy that value exactly from evidence.
- Keep the correct option wording as close as possible to the supporting evidence.
- Do not invent targets, definitions, thresholds, counts, or citations.
- Every citation object must include: passageId, page, startChar, endChar, quote.
- quote must be an exact short excerpt from the cited passage.
- If the candidate cannot be repaired reliably from the evidence, return {"discard": true}.

Return JSON only in one of these formats:
{
  "discard": true
}

or

{
  "questionText": "...",
  "options": [
    {"label":"A","text":"...","isCorrect":false},
    {"label":"B","text":"...","isCorrect":true},
    {"label":"C","text":"...","isCorrect":false},
    {"label":"D","text":"...","isCorrect":false}
  ],
  "explanation": "...",
  "difficulty": "easy|medium|hard",
  "learningObjective": "...",
  "citations": [
    {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
  ]
}`;

export const buildGroundedEssayPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
}) => `Create ${args.requestedCount} essay questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 14000)}

Rules:
- Question must be answerable from evidence.
- Provide model answer and rubricPoints (2-4 points).
- Include citations[] with exact evidence quote spans.

Return JSON only:
{
  "questions": [
    {
      "questionText": "...",
      "correctAnswer": "...",
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "questionType": "essay",
      "learningObjective": "...",
      "rubricPoints": ["...","..."],
      "citations": [
        {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
      ]
    }
  ]
}`;

export const buildGroundedConceptPrompt = (args: {
    topicTitle: string;
    evidence: RetrievedEvidence[];
    duplicateGuardSection?: string;
    retryGuidance?: string;
    seed: string;
}) => `Create one fill-in-the-blank concept exercise grounded in evidence.

TOPIC: ${args.topicTitle}
${formatEvidence(args.evidence, 10000)}

${args.duplicateGuardSection || ""}
${args.retryGuidance || ""}
SEED: ${args.seed}

Rules:
- template must include one "__" per answer.
- answers must align to blanks.
- tokens must include answers plus plausible distractors.
- Include citations[] with exact evidence quote spans that support the answers.

Return JSON only:
{
  "questionText": "...",
  "template": ["...","__","..."],
  "answers": ["..."],
  "tokens": ["..."],
  "citations": [
    {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
  ]
}`;
