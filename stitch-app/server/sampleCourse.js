import { createHash } from "node:crypto";
import { getPool } from "./db.js";
import { saveTopic } from "./topicWrites.js";
import { normalizeLesson } from "../src/lib/lessonSchema.js";

// A ready-made course new students can open before they upload anything, so
// their first session shows a real lesson, quiz and spaced review. Written by
// hand; it has no upload, so lessons carry no source quotes.
export const SAMPLE_COURSE_TITLE = "Sample course: How to study for exams";

const q = (prompt, options, correctIndex, explanation) => ({ prompt, options, correctIndex, explanation });

export const SAMPLE_TOPICS = [
    {
        title: "Why re-reading does not stick",
        description: "Active recall: test yourself instead of re-reading.",
        lesson: {
            hook: "Re-reading your notes feels productive, yet a week later most of it is gone. Testing yourself works better, even when it feels harder.",
            sections: [
                {
                    title: "The fluency trap",
                    role: "core",
                    body: "When you re-read, the words look **familiar**, so your brain tells you that you know them. Familiarity is not the same as being able to **recall** the idea in an exam, where there is no text in front of you.",
                },
                {
                    title: "Active recall",
                    role: "core",
                    body: "**Active recall** means pulling an idea out of memory without looking: answering a question, explaining a topic aloud, or writing what you remember on a blank page. Each successful recall makes the memory easier to find next time.",
                },
                {
                    title: "Turning notes into questions",
                    role: "steps",
                    body: "1. Read one section of your notes.\n2. Close the notes and write two or three questions about it.\n3. Answer them from memory.\n4. Check your answers and mark what you missed.\n5. Come back to the missed ones later.",
                },
                {
                    title: "Getting it wrong is part of it",
                    role: "misconception",
                    body: "Many students avoid quizzes until they feel ready. Missing a question during practice is useful: it shows you exactly what to review, and the correction is remembered better than a page you only re-read.",
                },
            ],
            recap: [
                { prompt: "Why does re-reading feel like learning?", answer: "The text feels familiar, which is mistaken for being able to recall it." },
                { prompt: "What is active recall?", answer: "Retrieving an idea from memory without looking, for example by answering questions." },
            ],
            wordBank: [
                { term: "Active recall", definition: "Retrieving information from memory instead of re-reading it." },
                { term: "Fluency illusion", definition: "Mistaking familiar-looking material for material you can recall." },
            ],
        },
        questions: [
            q("Which study method uses active recall?", ["Highlighting the textbook", "Re-reading lecture slides", "Answering questions without looking at notes", "Copying notes neatly"], 2, "Answering from memory forces you to retrieve the idea, which is active recall."),
            q("Why can re-reading give a false sense of mastery?", ["It takes too long", "Familiar text feels like knowledge you can recall", "It uses too much paper", "It only works for maths"], 1, "Recognising text is easier than recalling it, so re-reading makes you feel more prepared than you are."),
            q("What should you do with questions you miss during practice?", ["Ignore them", "Delete them from your notes", "Review them again later", "Only study them the night before"], 2, "Missed questions show exactly what to review; coming back to them later strengthens the memory."),
            q("Which is the first step in turning notes into questions?", ["Answer the questions", "Read one section of your notes", "Mark what you missed", "Close the notes"], 1, "You start by reading a section, then close your notes and write questions about it."),
        ],
    },
    {
        title: "Spacing: review just before you forget",
        description: "Spread reviews out over days instead of cramming.",
        lesson: {
            hook: "Five short sessions spread over two weeks beat one long night of cramming, even when the total time is the same.",
            sections: [
                {
                    title: "The forgetting curve",
                    role: "core",
                    body: "After you learn something, you start forgetting it quickly at first and then more slowly. Each time you **review** it, the memory lasts longer before it fades, so the gap until the next review can grow.",
                },
                {
                    title: "Spaced repetition",
                    role: "core",
                    body: "**Spaced repetition** schedules reviews at growing gaps, such as 1, 3, 7 and 16 days. Questions you get right move to longer gaps; questions you miss come back the next day.",
                },
                {
                    title: "A two-week plan before an exam",
                    role: "example",
                    body: "Ama has an exam in 14 days. She studies each topic once now, quizzes herself the next day, again 3 days later, and once more a week before the exam. Topics she keeps missing get extra sessions; the ones she knows well get fewer.",
                },
                {
                    title: "Cramming is not useless, just short-lived",
                    role: "misconception",
                    body: "Cramming can help you pass a test the next morning, but most of it is gone within days. For a final exam that covers the whole semester, spacing keeps material available when you need it.",
                },
            ],
            recap: [
                { prompt: "What happens to the gap between reviews as you keep getting a question right?", answer: "It grows, because the memory lasts longer after each review." },
                { prompt: "When does a missed question come back in spaced repetition?", answer: "Soon, usually the next day." },
            ],
            wordBank: [
                { term: "Spaced repetition", definition: "Reviewing material at gradually increasing intervals." },
                { term: "Forgetting curve", definition: "How quickly memory fades after learning if you do not review." },
            ],
        },
        questions: [
            q("In spaced repetition, what happens after you answer a review correctly?", ["It is deleted", "The next review comes after a longer gap", "It comes back the same day", "Nothing changes"], 1, "Correct answers move a question to a longer gap because the memory now lasts longer."),
            q("Which plan is most likely to help in a final exam two weeks away?", ["Study everything the night before", "Short reviews spread over the two weeks", "Read the textbook once", "Only study the hardest topic"], 1, "Spreading reviews out keeps the material available on exam day."),
            q("What does the forgetting curve describe?", ["How fast you read", "How memory fades after learning without review", "How hard an exam is", "How many topics a course has"], 1, "It shows memory dropping quickly at first, then more slowly, unless you review."),
            q("A question you keep missing should be reviewed…", ["less often", "never again", "more often", "only on exam day"], 2, "Missed questions need shorter gaps until you can recall them reliably."),
        ],
    },
    {
        title: "Practise under exam conditions",
        description: "Timed practice and past questions before the real exam.",
        lesson: {
            hook: "Knowing the material and answering it under time pressure are two different skills. Practise both.",
            sections: [
                {
                    title: "Why timed practice helps",
                    role: "core",
                    body: "In an exam you must recall ideas **quickly** and choose between similar options. Timed practice trains that speed and shows which topics slow you down, so you can review them before the day.",
                },
                {
                    title: "Using past questions",
                    role: "core",
                    body: "**Past questions** show the style, depth and topics your lecturers favour. Try them closed-book first, mark them honestly, then review the topics behind every wrong answer.",
                },
                {
                    title: "A final-week routine",
                    role: "steps",
                    body: "1. Take one timed exam covering the whole course.\n2. List the topics behind your wrong answers.\n3. Review those topics with short quizzes over the next days.\n4. Sleep well the night before instead of cramming.",
                },
            ],
            recap: [
                { prompt: "What does timed practice train besides knowledge?", answer: "Recalling answers quickly under exam pressure." },
                { prompt: "How should you use your wrong answers from a practice exam?", answer: "Review the topics behind them over the next days." },
            ],
            wordBank: [
                { term: "Past questions", definition: "Questions from earlier exams for the same course." },
            ],
        },
        questions: [
            q("What is the main benefit of a timed practice exam?", ["It replaces studying", "It trains quick recall and shows slow topics", "It guarantees a good grade", "It is shorter than a quiz"], 1, "Timing yourself trains speed and reveals which topics need more review."),
            q("How should you first attempt past questions?", ["With your notes open", "Closed-book, then mark honestly", "Only read the answers", "In a group without timing"], 1, "Closed-book attempts show what you can actually recall."),
            q("What should you do the night before the exam?", ["Cram every topic", "Sleep well", "Start a new topic", "Skip dinner to study"], 1, "Sleep helps you recall what you studied; cramming the night before adds little."),
        ],
    },
];

// Deterministic per user (one sample each) without putting the user id in URLs.
export const sampleCourseId = (userId) =>
    `sample-${createHash("sha256").update(`sample-course:${userId}`).digest("base64url").slice(0, 20)}`;

/**
 * Gives the user their own copy of the sample course (one per user) and
 * returns its id. Calling it again returns the existing course.
 */
export const createSampleCourseForUser = async (userId) => {
    const courseId = sampleCourseId(userId);
    const db = getPool();
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const inserted = await client.query(
            `INSERT INTO courses (id, user_id, title, description, status)
             VALUES ($1, $2, $3, $4, 'ready')
             ON CONFLICT (id) DO NOTHING`,
            [courseId, userId, SAMPLE_COURSE_TITLE, "Three short lessons with quizzes to try ChewnPour before uploading your own notes."],
        );
        if (inserted.rowCount > 0) {
            for (const [index, topic] of SAMPLE_TOPICS.entries()) {
                await saveTopic(client, {
                    courseId,
                    userId,
                    uploadId: null,
                    sortOrder: index,
                    spec: {
                        title: topic.title,
                        description: topic.description,
                        lesson: normalizeLesson(topic.lesson),
                        questions: topic.questions.map((question, order) => ({ ...question, sortOrder: order })),
                    },
                });
            }
        }
        await client.query("COMMIT");
        return { courseId, created: inserted.rowCount > 0 };
    } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        client.release();
    }
};
