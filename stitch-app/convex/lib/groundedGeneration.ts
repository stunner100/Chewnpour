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
    bloomLevel: string;
    outcomeKey: string;
    authenticContext?: string;
};

export type GroundedEssayCandidate = {
    questionText: string;
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
    mcqPlan: {
        allowedBloomLevels: string[];
        targetBloomLevels: string[];
        targetOutcomeKeys: string[];
    };
    essayPlan: {
        allowedBloomLevels: string[];
        targetBloomLevels: string[];
        targetOutcomeKeys: string[];
        authenticScenarioRequired: boolean;
        authenticContextHint?: string;
    };
};

export type AssessmentCoverageTarget = {
    outcomeKey: string;
    bloomLevel: string;
    objective?: string;
    evidenceFocus?: string;
    requestedCount: number;
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

const formatCoverageTargets = (coverageTargets: AssessmentCoverageTarget[] = []) => {
    if (!Array.isArray(coverageTargets) || coverageTargets.length === 0) {
        return "";
    }

    return coverageTargets
        .map((target) => [
            `- outcomeKey=${target.outcomeKey}`,
            `bloomLevel=${target.bloomLevel}`,
            `requestedCount=${target.requestedCount}`,
            target.objective ? `objective="${target.objective}"` : "",
            target.evidenceFocus ? `evidenceFocus="${target.evidenceFocus}"` : "",
        ].filter(Boolean).join("; "))
        .join("\n");
};

export const buildGroundedAssessmentBlueprintPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    evidence: RetrievedEvidence[];
}) => `Create an assessment blueprint for MCQ and essay generation using Bloom's taxonomy, constructive alignment, and authentic assessment.

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
- mcqPlan.targetOutcomeKeys must reference outcomes appropriate for MCQ only.
- essayPlan.targetOutcomeKeys must reference outcomes appropriate for essay only.
- MCQ outcomes should support only: Remember, Understand, Apply, Analyze.
- Essay outcomes should support only: Analyze, Evaluate, Create.
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
  "mcqPlan": {
    "targetOutcomeKeys": ["outcome-1"]
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
    coverageTargets?: AssessmentCoverageTarget[];
}) => {
    const existingBlock = args.existingQuestionSample
        ? `\nExisting questions to avoid:\n${args.existingQuestionSample}`
        : "";
    const coverageBlock = Array.isArray(args.coverageTargets) && args.coverageTargets.length > 0
        ? `\nCoverage gaps to prioritize first:\n${formatCoverageTargets(args.coverageTargets)}`
        : "";

    return `Create ${args.requestedCount} multiple-choice questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}
${coverageBlock}
${existingBlock}

Rules:
- Each question must be answerable only from evidence above.
- Use only outcome keys from assessmentBlueprint.mcqPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- bloomLevel must be one of: Remember, Understand, Apply, Analyze.
- If coverage gaps are listed, satisfy those outcome priorities before generating extras.
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
}) => `Repair the multiple-choice question below so it is strictly grounded in the evidence passages.

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
- Use exactly 4 options with one correct answer.
- The marked correct option must be directly supported by the cited evidence.
- If the correct option includes a number, percentage, threshold, rate, count, or limit, copy that value exactly from evidence.
- Keep the correct option wording as close as possible to the supporting evidence.
- Do not invent targets, definitions, thresholds, counts, or citations.
- Every citation object must include: passageId, page, startChar, endChar, quote.
- quote must be an exact short excerpt from the cited passage.
- If the candidate cannot be repaired reliably from the evidence, return {"discard": true}.
- Use only outcome keys from assessmentBlueprint.mcqPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.

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
  "bloomLevel": "Remember|Understand|Apply|Analyze",
  "outcomeKey": "outcome-1",
  "citations": [
    {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
  ]
}`;

export const buildGroundedEssayPrompt = (args: {
    topicTitle: string;
    topicDescription?: string;
    requestedCount: number;
    evidence: RetrievedEvidence[];
    assessmentBlueprint: AssessmentBlueprint;
    coverageTargets?: AssessmentCoverageTarget[];
}) => `Create ${args.requestedCount} essay questions strictly grounded in the evidence passages.

TOPIC: ${args.topicTitle}
DESCRIPTION: ${args.topicDescription || "General concepts"}

${formatEvidence(args.evidence, 14000)}
ASSESSMENT_BLUEPRINT:
${formatAssessmentBlueprint(args.assessmentBlueprint)}
${Array.isArray(args.coverageTargets) && args.coverageTargets.length > 0
        ? `\nCoverage gaps to prioritize first:\n${formatCoverageTargets(args.coverageTargets)}`
        : ""}

Rules:
- Question must be answerable from evidence.
- Use only outcome keys from assessmentBlueprint.essayPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- bloomLevel must be one of: Analyze, Evaluate, Create.
- If coverage gaps are listed, satisfy those outcome priorities before generating extras.
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
