"use node";

import type { RetrievedEvidence } from "./groundedRetrieval";

export type GroundedCitation = {
    passageId: string;
    page: number;
    startChar: number;
    endChar: number;
    quote: string;
};

export type GroundedMultipleChoiceCandidate = {
    questionText: string;
    questionType?: "multiple_choice";
    options: Array<{ label: string; text: string; isCorrect: boolean }>;
    correctAnswer?: string;
    explanation?: string;
    difficulty?: string;
    citations: GroundedCitation[];
    learningObjective?: string;
    bloomLevel: string;
    outcomeKey: string;
    authenticContext?: string;
};

export type GroundedTrueFalseCandidate = {
    questionText: string;
    questionType?: "true_false";
    options: Array<{ label: string; text: string; isCorrect: boolean }>;
    correctAnswer?: string;
    explanation?: string;
    difficulty?: string;
    citations: GroundedCitation[];
    learningObjective?: string;
    bloomLevel: string;
    outcomeKey: string;
};

export type GroundedFillBlankCandidate = {
    questionText: string;
    questionType?: "fill_blank";
    templateParts: string[];
    acceptedAnswers: string[];
    tokens?: string[];
    fillBlankMode?: "token_bank" | "free_text";
    correctAnswer?: string;
    explanation?: string;
    difficulty?: string;
    citations: GroundedCitation[];
    learningObjective?: string;
    bloomLevel: string;
    outcomeKey: string;
};

export type GroundedEssayCandidate = {
    questionText: string;
    questionType?: "essay";
    correctAnswer: string;
    explanation?: string;
    difficulty?: string;
    citations: GroundedCitation[];
    rubricPoints?: string[];
    learningObjective?: string;
    bloomLevel: string;
    outcomeKey: string;
    authenticContext?: string;
};

export type AssessmentBlueprintOutcome = {
    key: string;
    objective: string;
    bloomLevel: string;
    evidenceFocus: string;
};

export type AssessmentBlueprint = {
    version: string;
    outcomes: AssessmentBlueprintOutcome[];
    objectivePlan: {
        allowedQuestionTypes: string[];
        targetQuestionTypes: string[];
        targetMix: {
            multiple_choice: number;
            true_false: number;
            fill_blank: number;
        };
        targetOutcomeKeys: string[];
        targetBloomLevels?: string[];
    };
    multipleChoicePlan: {
        allowedBloomLevels: string[];
        targetBloomLevels: string[];
        targetOutcomeKeys: string[];
    };
    trueFalsePlan: {
        allowedBloomLevels: string[];
        targetBloomLevels: string[];
        targetOutcomeKeys: string[];
    };
    fillBlankPlan: {
        allowedBloomLevels: string[];
        targetBloomLevels: string[];
        targetOutcomeKeys: string[];
        tokenBankRequired: boolean;
        exactAnswerOnly: boolean;
    };
    essayPlan: {
        allowedBloomLevels: string[];
        targetBloomLevels: string[];
        targetOutcomeKeys: string[];
        authenticScenarioRequired: boolean;
        authenticContextHint?: string;
    };
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

const formatAssessmentBlueprint = (blueprint: AssessmentBlueprint) =>
    JSON.stringify(blueprint, null, 2);

export const buildGroundedAssessmentBlueprintPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    evidence: RetrievedEvidence[];
}) => `Create an assessment blueprint for objective and essay generation using Bloom's taxonomy, constructive alignment, and authentic assessment.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 14000)}

Rules:
- Use only the evidence above.
- Return 3-6 outcomes.
- Each outcome must include: key, objective, bloomLevel, evidenceFocus.
- bloomLevel must be one of: Remember, Understand, Apply, Analyze, Evaluate, Create.
- outcome key must be short and stable, such as "outcome-1" or "apply-methods".
- outcomes should be suitable for university assessment design.
- objectivePlan.targetMix must equal:
  - multiple_choice: 5
  - true_false: 3
  - fill_blank: 2
- objectivePlan.targetQuestionTypes must include exactly: multiple_choice, true_false, fill_blank.
- multipleChoicePlan.targetOutcomeKeys must reference outcomes appropriate for multiple-choice only.
- trueFalsePlan.targetOutcomeKeys must reference outcomes appropriate for true/false only.
- fillBlankPlan.targetOutcomeKeys must reference outcomes appropriate for fill-in-the-blank only.
- essayPlan.targetOutcomeKeys must reference outcomes appropriate for essay only.
- multiple_choice outcomes should support only: Remember, Understand, Apply, Analyze.
- true_false outcomes should support only: Remember, Understand, Apply.
- fill_blank outcomes should support only: Remember, Understand, Apply.
- essay outcomes should support only: Analyze, Evaluate, Create.
- fillBlankPlan.tokenBankRequired must be true.
- fillBlankPlan.exactAnswerOnly must be true.
- Set essayPlan.authenticScenarioRequired to true only when the evidence supports realistic or professional application framing.
- If essayPlan.authenticScenarioRequired is true, include essayPlan.authenticContextHint as a short scenario cue grounded in the evidence.
- Do not include any fields outside the required schema.

Return JSON only:
{
  "outcomes": [
    {
      "key": "outcome-1",
      "objective": "...",
      "bloomLevel": "Analyze",
      "evidenceFocus": "..."
    }
  ],
  "objectivePlan": {
    "targetQuestionTypes": ["multiple_choice", "true_false", "fill_blank"],
    "targetMix": {
      "multiple_choice": 5,
      "true_false": 3,
      "fill_blank": 2
    },
    "targetOutcomeKeys": ["outcome-1"]
  },
  "multipleChoicePlan": {
    "targetOutcomeKeys": ["outcome-1"]
  },
  "trueFalsePlan": {
    "targetOutcomeKeys": ["outcome-1"]
  },
  "fillBlankPlan": {
    "targetOutcomeKeys": ["outcome-1"],
    "tokenBankRequired": true,
    "exactAnswerOnly": true
  },
  "essayPlan": {
    "targetOutcomeKeys": ["outcome-2"],
    "authenticScenarioRequired": false,
    "authenticContextHint": "..."
  }
}`;

export const buildGroundedMcqPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
    assessmentBlueprint: AssessmentBlueprint;
    existingQuestionSample?: string;
}) => {
    const existingBlock = args.existingQuestionSample
        ? `\nExisting questions to avoid:\n${args.existingQuestionSample}`
        : "";

    return `Create ${args.requestedCount} multiple-choice questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}
${existingBlock}

Rules:
- Each question must be answerable only from evidence above.
- questionType must be "multiple_choice".
- Use only outcome keys from assessmentBlueprint.multipleChoicePlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- bloomLevel must be one of: Remember, Understand, Apply, Analyze.
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
      "questionType": "multiple_choice",
      "options": [
        {"label":"A","text":"...","isCorrect":false},
        {"label":"B","text":"...","isCorrect":true},
        {"label":"C","text":"...","isCorrect":false},
        {"label":"D","text":"...","isCorrect":false}
      ],
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "learningObjective": "...",
      "bloomLevel": "Remember|Understand|Apply|Analyze",
      "outcomeKey": "outcome-1",
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
    assessmentBlueprint: AssessmentBlueprint;
    candidate: any;
    repairReasons?: string[];
}) => `Repair the objective multiple-choice question below so it is strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 10000)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}

REPAIR REASONS:
${Array.isArray(args.repairReasons) && args.repairReasons.length > 0
        ? args.repairReasons.map((reason) => `- ${reason}`).join("\n")
        : "- Candidate must remain fully supported by evidence."}

CANDIDATE JSON:
${JSON.stringify(args.candidate, null, 2)}

Rules:
- Keep the same question intent only if it is fully supported by the evidence.
- If the current question intent is not supported, rewrite the question so it matches the evidence exactly.
- questionType must be "multiple_choice".
- Use exactly 4 options with one correct answer.
- The marked correct option must be directly supported by the cited evidence.
- If the correct option includes a number, percentage, threshold, rate, count, or limit, copy that value exactly from evidence.
- Keep the correct option wording as close as possible to the supporting evidence.
- Do not invent targets, definitions, thresholds, counts, or citations.
- Every citation object must include: passageId, page, startChar, endChar, quote.
- quote must be an exact short excerpt from the cited passage.
- If the candidate cannot be repaired reliably from the evidence, return {"discard": true}.
- Use only outcome keys from assessmentBlueprint.multipleChoicePlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.

Return JSON only in one of these formats:
{
  "discard": true
}

or

{
  "questionText": "...",
  "questionType": "multiple_choice",
  "options": [
    {"label":"A","text":"...","isCorrect":false},
    {"label":"B","text":"...","isCorrect":true},
    {"label":"C","text":"...","isCorrect":false},
    {"label":"D","text":"...","isCorrect":false}
  ],
  "explanation": "...",
  "difficulty": "easy|medium|hard",
  "learningObjective": "...",
  "bloomLevel": "Remember|Understand|Apply|Analyze",
  "outcomeKey": "outcome-1",
  "citations": [
    {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
  ]
}`;

export const buildGroundedTrueFalsePrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
    assessmentBlueprint: AssessmentBlueprint;
}) => `Create ${args.requestedCount} true/false questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 12000)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}

Rules:
- Each question must be answerable only from evidence above.
- questionType must be "true_false".
- Use only outcome keys from assessmentBlueprint.trueFalsePlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- bloomLevel must be one of: Remember, Understand, Apply.
- Each question must be a single clear statement.
- Use exactly 2 options: True and False.
- Exactly one option must be correct.
- If False is correct, the statement must be directly contradicted by the evidence, not vaguely unsupported.
- Do not write tricky, opinion-based, or ambiguous statements.
- Every question must include citations[] with 1-3 citation objects.
- Every citation object must include: passageId, page, startChar, endChar, quote.
- quote must be an exact short excerpt from the cited passage.

Return JSON only:
{
  "questions": [
    {
      "questionText": "...",
      "questionType": "true_false",
      "options": [
        {"label":"A","text":"True","isCorrect":false},
        {"label":"B","text":"False","isCorrect":true}
      ],
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "learningObjective": "...",
      "bloomLevel": "Remember|Understand|Apply",
      "outcomeKey": "outcome-1",
      "citations": [
        {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
      ]
    }
  ]
}`;

export const buildGroundedFillBlankPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
    assessmentBlueprint: AssessmentBlueprint;
}) => `Create ${args.requestedCount} fill-in-the-blank questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 12000)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}

Rules:
- Each question must be answerable only from evidence above.
- questionType must be "fill_blank".
- Use only outcome keys from assessmentBlueprint.fillBlankPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- bloomLevel must be one of: Remember, Understand, Apply.
- Use exactly one blank only.
- templateParts must contain exactly one "__" entry.
- acceptedAnswers must contain the canonical correct answer first, then any exact aliases supported by the evidence.
- Answers must be short and exact.
- fillBlankMode must be either "token_bank" or "free_text".
- For token_bank items, include tokens with 4-6 entries including the correct answer.
- For free_text items, omit tokens.
- Do not invent unsupported aliases.
- Every question must include citations[] with 1-3 citation objects.
- Every citation object must include: passageId, page, startChar, endChar, quote.
- quote must be an exact short excerpt from the cited passage.

Return JSON only:
{
  "questions": [
    {
      "questionText": "...",
      "questionType": "fill_blank",
      "templateParts": ["The capital of Ghana is ", "__", "."],
      "acceptedAnswers": ["Accra"],
      "tokens": ["Accra", "Kumasi", "Tamale", "Cape Coast"],
      "fillBlankMode": "token_bank",
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "learningObjective": "...",
      "bloomLevel": "Remember|Understand|Apply",
      "outcomeKey": "outcome-1",
      "citations": [
        {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
      ]
    }
  ]
}`;

export const buildGroundedEssayPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
    assessmentBlueprint: AssessmentBlueprint;
}) => `Create ${args.requestedCount} essay questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 14000)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}

Rules:
- Question must be answerable from evidence.
- Use only outcome keys from assessmentBlueprint.essayPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- bloomLevel must be one of: Analyze, Evaluate, Create.
- Provide model answer and rubricPoints (2-4 points).
- Include citations[] with exact evidence quote spans.
- If assessmentBlueprint.essayPlan.authenticScenarioRequired is true, prefer a realistic or professional scenario framing and include authenticContext.
- Do not invent scenario facts beyond what the evidence can support.

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
      "bloomLevel": "Analyze|Evaluate|Create",
      "outcomeKey": "outcome-1",
      "authenticContext": "...",
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
