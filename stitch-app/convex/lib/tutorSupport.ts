export const DEFAULT_TUTOR_PERSONA = "coach";

export const TUTOR_PERSONAS = {
    coach: {
        key: "coach",
        label: "Exam Coach",
        description: "Encouraging, practical, and focused on getting to a stronger answer fast.",
        prompt:
            "Adopt the voice of an encouraging exam coach. Be direct, practical, and focused on helping the student improve quickly. "
            + "Call out what matters most, then give the next best step.",
    },
    socratic: {
        key: "socratic",
        label: "Socratic Guide",
        description: "Guides the student with questions and helps them reason things out.",
        prompt:
            "Adopt the voice of a Socratic tutor. Lead with 1-2 short guiding questions before explaining. "
            + "Help the student reason from the lesson evidence instead of jumping straight to the conclusion.",
    },
    patient: {
        key: "patient",
        label: "Patient Explainer",
        description: "Breaks ideas down gently, simply, and step by step.",
        prompt:
            "Adopt the voice of a patient explainer. Use simple language, short sentences, and step-by-step teaching. "
            + "Assume the student may be confused and rebuild understanding from first principles.",
    },
    concise: {
        key: "concise",
        label: "Concise Tutor",
        description: "Short, clear answers with minimal extra detail.",
        prompt:
            "Adopt the voice of a concise tutor. Keep answers compact, clear, and high-signal. "
            + "Prefer short paragraphs and bullet-free prose unless steps are necessary.",
    },
} as const;

export type TutorPersonaKey = keyof typeof TUTOR_PERSONAS;

export const normalizeTutorPersona = (value: unknown): TutorPersonaKey => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized in TUTOR_PERSONAS) {
        return normalized as TutorPersonaKey;
    }
    return DEFAULT_TUTOR_PERSONA;
};

export const getTutorPersonaPrompt = (value: unknown) =>
    TUTOR_PERSONAS[normalizeTutorPersona(value)].prompt;

const formatQuestionList = (items: string[]) =>
    items
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" | ");

export const buildTutorMemorySnapshot = (args: {
    topicTitle: string;
    topicDescription?: string;
    assessmentRoute?: string;
    topicProgress?: {
        completedAt?: number;
        bestScore?: number;
        lastStudiedAt?: number;
    } | null;
    latestAttempt?: {
        percentage?: number;
        incorrectAnswers?: Array<{ questionText?: string }>;
    } | null;
    recentMessages?: Array<{ role?: string; content?: string }>;
    previousSummary?: string;
    lastQuestion?: string;
    lastAnswer?: string;
}) => {
    const progress = args.topicProgress || null;
    const latestAttempt = args.latestAttempt || null;
    const recentMessages = Array.isArray(args.recentMessages) ? args.recentMessages : [];

    const recentUserQuestions = recentMessages
        .filter((message) => String(message?.role || "") === "user")
        .map((message) => String(message?.content || "").trim())
        .filter(Boolean)
        .slice(-3);

    const weakAreas = (latestAttempt?.incorrectAnswers || [])
        .map((entry) => String(entry?.questionText || "").trim())
        .filter(Boolean)
        .slice(0, 3);

    const strengths: string[] = [];
    const bestScore = Number(progress?.bestScore);
    const latestScore = Number(latestAttempt?.percentage);

    if (Number.isFinite(bestScore)) {
        if (bestScore >= 80) {
            strengths.push(`Strong past performance on ${args.topicTitle} (${Math.round(bestScore)}%).`);
        } else if (bestScore >= 60) {
            strengths.push(`Moderate past performance on ${args.topicTitle} (${Math.round(bestScore)}%).`);
        }
    }

    if (progress?.completedAt) {
        strengths.push("The student has completed the lesson.");
    }

    const routeLabel = args.assessmentRoute === "final_exam_only"
        ? "This topic is assessed through the final exam rather than a standalone topic quiz."
        : args.assessmentRoute === "topic_quiz"
            ? "This topic is strong enough for a standalone topic quiz."
            : "";

    const carryForwardSummary = String(args.previousSummary || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 220);

    const summaryParts = [
        `Topic: ${args.topicTitle}.`,
        args.topicDescription ? `Lesson focus: ${String(args.topicDescription).trim()}.` : "",
        routeLabel,
        progress
            ? progress.completedAt
                ? "Lesson status: completed."
                : "Lesson status: still in progress."
            : "Lesson status: no progress recorded yet.",
        Number.isFinite(bestScore) ? `Best recorded score: ${Math.round(bestScore)}%.` : "",
        Number.isFinite(latestScore) ? `Latest exam score: ${Math.round(latestScore)}%.` : "",
        weakAreas.length > 0 ? `Recent weak areas: ${formatQuestionList(weakAreas)}.` : "",
        recentUserQuestions.length > 0 ? `Recent tutor questions: ${formatQuestionList(recentUserQuestions)}.` : "",
        carryForwardSummary ? `Carry-forward note: ${carryForwardSummary}` : "",
    ].filter(Boolean);

    return {
        memorySummary: summaryParts.join(" "),
        strengths: strengths.slice(0, 3),
        weakAreas,
        lastQuestion: String(args.lastQuestion || "").trim(),
        lastAnswer: String(args.lastAnswer || "").trim(),
    };
};
