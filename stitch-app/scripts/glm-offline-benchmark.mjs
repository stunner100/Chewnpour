import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.cwd();

const parseArgs = (argv) => {
  const out = {
    mode: 'objective',
    timeoutMs: 600000,
    requestedCount: undefined,
    includeLesson: true,
    mcqOnly: true,
    out: '',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--mode' && next) {
      out.mode = next;
      i += 1;
    } else if (token === '--timeout-ms' && next) {
      out.timeoutMs = Number(next);
      i += 1;
    } else if (token === '--requested-count' && next) {
      out.requestedCount = Number(next);
      i += 1;
    } else if (token === '--user-id' && next) {
      out.userId = next;
      i += 1;
    } else if (token === '--topic-id' && next) {
      out.topicId = next;
      i += 1;
    } else if (token === '--attempt-id' && next) {
      out.attemptId = next;
      i += 1;
    } else if (token === '--out' && next) {
      out.out = next;
      i += 1;
    } else if (token === '--reduced-context') {
      out.includeLesson = false;
    } else if (token === '--full-context') {
      out.includeLesson = true;
    } else if (token === '--mixed-objective') {
      out.mcqOnly = false;
    }
  }
  return out;
};

const args = parseArgs(process.argv.slice(2));
if (!args.userId || !args.topicId || !args.attemptId) {
  console.error('Usage: node scripts/glm-offline-benchmark.mjs --user-id <id> --topic-id <id> --attempt-id <id> [--mode objective|essay] [--timeout-ms 600000] [--requested-count N] [--full-context|--reduced-context] [--mixed-objective] [--out /tmp/file.json]');
  process.exit(1);
}

const runConvex = (subcommandArgs) =>
  execFileSync('npx', ['convex', ...subcommandArgs], {
    cwd: repo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const getConvexJson = (fn, fnArgs) =>
  JSON.parse(runConvex([
    'run',
    fn,
    '--prod',
    '--identity',
    JSON.stringify({ subject: args.userId }),
    JSON.stringify(fnArgs),
  ]));

const getEnvValue = (name) => runConvex(['env', 'get', name, '--prod']);

const formatRetrievedEvidenceForPrompt = (evidence, maxChars = 14000) =>
  evidence
    .map((entry, index) => {
      const trimmed = String(entry.text || '').slice(0, 900).trim();
      return [
        `EVIDENCE_${index + 1}:`,
        `passageId=${entry.passageId}; page=${entry.page}; start=${entry.startChar}; end=${entry.endChar}`,
        `"""${trimmed}"""`,
      ].join('\n');
    })
    .join('\n\n')
    .slice(0, maxChars);

const buildFreshLessonContext = (topic, includeLesson) => {
  const structuredObjectives = Array.isArray(topic?.structuredLearningObjectives)
    ? topic.structuredLearningObjectives
        .map((item) => (typeof item === 'string' ? item.trim() : String(item?.text || item?.title || item?.objective || '').trim()))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const structuredSubtopics = Array.isArray(topic?.structuredSubtopics)
    ? topic.structuredSubtopics
        .map((item) => (typeof item === 'string' ? item.trim() : String(item?.title || item?.text || item?.name || '').trim()))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return [
    `TOPIC: ${String(topic?.title || '').trim()}`,
    `DESCRIPTION: ${String(topic?.description || '').trim() || 'General concepts'}`,
    structuredObjectives.length > 0
      ? `LEARNING OBJECTIVES:\n${structuredObjectives.map((item) => `- ${item}`).join('\n')}`
      : '',
    structuredSubtopics.length > 0
      ? `SUBTOPICS:\n${structuredSubtopics.map((item) => `- ${item}`).join('\n')}`
      : '',
    includeLesson
      ? `LESSON CONTENT:\n"""\n${String(topic?.content || '').slice(0, 12000)}\n"""`
      : '',
  ].filter(Boolean).join('\n\n');
};

const buildFreshObjectiveTypeMix = (requestedCount) => {
  const safeCount = Math.max(1, Math.round(Number(requestedCount || 1)));
  if (safeCount === 1) return { multiple_choice: 1, true_false: 0, fill_blank: 0 };
  if (safeCount === 2) return { multiple_choice: 1, true_false: 1, fill_blank: 0 };
  return { multiple_choice: Math.max(1, safeCount - 2), true_false: 1, fill_blank: 1 };
};

const buildFreshObjectiveExamPrompt = ({ topic, requestedCount, evidence, assessmentBlueprint, forceQuestionType, includeLesson }) => {
  const mix = buildFreshObjectiveTypeMix(requestedCount);
  const generationRule = forceQuestionType === 'multiple_choice'
    ? `- Generate exactly ${requestedCount} "multiple_choice" questions. Do not generate true_false or fill_blank questions.`
    : `- Generate exactly ${mix.multiple_choice} "multiple_choice" questions, ${mix.true_false} "true_false" questions, and ${mix.fill_blank} "fill_blank" questions.`;

  return `Generate exactly ${requestedCount} objective exam questions from the topic lesson and grounded evidence.

${buildFreshLessonContext(topic, includeLesson)}

GROUNDED EVIDENCE:
${formatRetrievedEvidenceForPrompt(evidence)}

ASSESSMENT BLUEPRINT:
${JSON.stringify(assessmentBlueprint, null, 2)}

Rules:
${generationRule}
- Use only the lesson context and grounded evidence above.
- Use only outcome keys from assessmentBlueprint.mcqPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- Every question must include citations with exact evidence quotes and passage metadata.
- Every question must include explanation, difficulty, learningObjective, bloomLevel, and outcomeKey.
- For multiple_choice:
  - include exactly 4 options
  - set correctAnswer to the correct option label only
- For true_false:
  - include exactly 2 options labeled A and B, with texts "True" and "False"
  - set correctAnswer to the correct option label only
- For fill_blank:
  - do not include options
  - set correctAnswer to the canonical answer text
  - include acceptedAnswers with 1-4 acceptable answer strings
- Avoid duplicates and avoid repeatedly testing the same fact.
- Return JSON only.

Return JSON only:
{
  "questions": [
    {
      "questionType": "multiple_choice|true_false|fill_blank",
      "questionText": "...",
      "options": [
        {"label":"A","text":"...","isCorrect":false}
      ],
      "correctAnswer": "A",
      "acceptedAnswers": ["..."],
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

const buildFreshEssayExamPrompt = ({ topic, requestedCount, evidence, assessmentBlueprint, includeLesson }) => `Generate exactly ${requestedCount} essay exam questions from the topic lesson and grounded evidence.

${buildFreshLessonContext(topic, includeLesson)}

GROUNDED EVIDENCE:
${formatRetrievedEvidenceForPrompt(evidence)}

ASSESSMENT BLUEPRINT:
${JSON.stringify(assessmentBlueprint, null, 2)}

Rules:
- Generate exactly ${requestedCount} essay questions.
- Use only outcome keys from assessmentBlueprint.essayPlan.targetOutcomeKeys.
- bloomLevel must exactly match the selected outcome's bloomLevel.
- Every essay question must include:
  - questionText
  - correctAnswer
  - explanation
  - rubricPoints with 2-4 items
  - citations with exact evidence quotes and passage metadata
  - learningObjective, bloomLevel, outcomeKey
- If the blueprint supports authentic scenario framing, include authenticContext.
- Avoid duplicate prompts and avoid prompts that can be answered in one short sentence.
- Return JSON only.

Return JSON only:
{
  "questions": [
    {
      "questionType": "essay",
      "questionText": "...",
      "correctAnswer": "...",
      "explanation": "...",
      "difficulty": "easy|medium|hard",
      "learningObjective": "...",
      "bloomLevel": "Analyze|Evaluate|Create",
      "outcomeKey": "outcome-1",
      "authenticContext": "...",
      "rubricPoints": ["..."],
      "citations": [
        {"passageId":"p1-0","page":0,"startChar":0,"endChar":80,"quote":"..."}
      ]
    }
  ]
}`;

const parseJsonFromResponse = (raw) => {
  const trimmed = String(raw || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in provider response');
    const sanitized = match[0].replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001F]+/g, '');
    return JSON.parse(sanitized);
  }
};

const topic = getConvexJson('topics:getTopicWithQuestions', { topicId: args.topicId });
const attempt = getConvexJson('exams:getExamAttempt', { attemptId: args.attemptId });
const evidence = Array.isArray(attempt?.generationContext?.evidence) ? attempt.generationContext.evidence : [];
const requestedCount = Number.isFinite(args.requestedCount)
  ? args.requestedCount
  : args.mode === 'essay'
    ? 2
    : 5;

const prompt = args.mode === 'essay'
  ? buildFreshEssayExamPrompt({
      topic,
      requestedCount,
      evidence,
      assessmentBlueprint: topic.assessmentBlueprint,
      includeLesson: args.includeLesson,
    })
  : buildFreshObjectiveExamPrompt({
      topic,
      requestedCount,
      evidence,
      assessmentBlueprint: topic.assessmentBlueprint,
      forceQuestionType: args.mcqOnly ? 'multiple_choice' : undefined,
      includeLesson: args.includeLesson,
    });

const baseUrl = getEnvValue('OPENAI_BASE_URL');
const model = getEnvValue('OPENAI_MODEL');
const apiKey = getEnvValue('OPENAI_API_KEY');
const outFile = args.out || path.join('/tmp', `glm-${args.mode}-benchmark-${Date.now()}.json`);
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), Math.max(1000, Math.round(Number(args.timeoutMs || 600000))));
const startedAt = Date.now();

try {
  const response = await fetch(new URL('chat/completions', baseUrl).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an expert exam author. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: args.mode === 'essay' ? 3200 : 5200,
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`GLM request failed: ${response.status} ${responseBody}`);
  }
  const outer = JSON.parse(responseBody || '{}');
  const content = String(outer?.choices?.[0]?.message?.content || '').trim();
  const parsed = parseJsonFromResponse(content);
  const result = {
    ok: true,
    provider: 'openai-compatible',
    model,
    mode: args.mode,
    includeLesson: args.includeLesson,
    requestedCount,
    durationMs: Date.now() - startedAt,
    promptChars: prompt.length,
    topicTitle: topic.title,
    topicId: args.topicId,
    sourceAttemptId: args.attemptId,
    questions: parsed.questions,
  };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({
    ok: true,
    mode: result.mode,
    model: result.model,
    durationMs: result.durationMs,
    promptChars: result.promptChars,
    questionCount: Array.isArray(result.questions) ? result.questions.length : 0,
    out: outFile,
  }, null, 2));
} catch (error) {
  const failure = {
    ok: false,
    mode: args.mode,
    durationMs: Date.now() - startedAt,
    promptChars: prompt.length,
    message: error instanceof Error ? error.message : String(error),
    out: outFile,
  };
  fs.writeFileSync(outFile, JSON.stringify(failure, null, 2));
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
} finally {
  clearTimeout(timeoutId);
}
