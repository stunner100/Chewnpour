// The outline labels each topic with a kind. The kind only suggests which
// optional section roles (see LESSON_ROLES in lessonSchema.js) suit the topic;
// section titles always come from the content.
export const LESSON_KINDS = ["narrative", "procedure", "concept", "argument"];

export const normalizeLessonKind = (value) => {
    const kind = String(value || "").trim().toLowerCase();
    return LESSON_KINDS.includes(kind) ? kind : null;
};

const KIND_HINTS = {
    narrative:
        "This topic is a narrative (history or events). Use core sections for who, when, causes and consequences, in time order. Use an example section only for a concrete episode the snippet names. Do not invent steps, calculations or rival accounts the snippet does not give.",
    procedure:
        "This topic is a procedure the learner can perform. Put the process in a steps section as a numbered list, follow it with an example section that works through the process, and add a misconception section for a mistake the snippet warns about or that the steps make likely. A practice section can give a short task.",
    concept:
        "This topic is a concept or mechanism. Explain it in core sections, then use an example section for a case from the snippet and a misconception section for a wrong idea students hold, stating the correct account.",
    argument:
        "This topic is an argument or debate. Use core sections for the claim and the evidence the snippet gives, and include an opposing view only if the snippet states one. A core section can weigh the evidence.",
};

export const promptBlockForLessonKind = (kind) => KIND_HINTS[normalizeLessonKind(kind) || "concept"];
