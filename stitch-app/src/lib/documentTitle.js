export const BRAND_NAME = 'ChewnPour';

// "Cell Theory" -> "Cell Theory · ChewnPour"; empty -> "ChewnPour".
export const formatDocumentTitle = (name) => {
    const text = String(name || '').replace(/\s+/g, ' ').trim();
    return text ? `${text} · ${BRAND_NAME}` : BRAND_NAME;
};

// Most specific prefix first. Pages with their own subject (a lesson, a quiz)
// replace these with useDocumentTitle once their data loads.
const ROUTE_TITLES = [
    ['/dashboard/quiz/results', 'Quiz results'],
    ['/dashboard/quiz', 'Quizzes'],
    ['/dashboard/topic', 'Lesson'],
    ['/dashboard/library', 'My Materials'],
    ['/dashboard/upload', 'Upload'],
    ['/dashboard/lessons', 'Lessons'],
    ['/dashboard/exam', 'Timed exams'],
    ['/dashboard/past-questions', 'Past questions'],
    ['/dashboard/ai-tutor', 'AI Tutor'],
    ['/dashboard/progress', 'Progress'],
    ['/dashboard/podcasts', 'Podcasts'],
    ['/dashboard/settings', 'Settings'],
    ['/dashboard', 'Dashboard'],
    ['/login', 'Log in'],
    ['/signup', 'Sign up'],
    ['/reset-password', 'Reset password'],
    ['/terms', 'Terms of Service'],
    ['/privacy', 'Privacy Policy'],
    ['/unsubscribe', 'Unsubscribe'],
    ['/research', 'Research'],
    ['/c/', 'Shared course'],
    ['/admin', 'Admin'],
];

export const resolveRouteTitle = (pathname = '/') => {
    const path = String(pathname || '/');
    const match = ROUTE_TITLES.find(([prefix]) =>
        prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix || path.startsWith(`${prefix}/`),
    );
    return formatDocumentTitle(match?.[1] || '');
};
