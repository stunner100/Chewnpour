// Past-questions helpers shared by the student page and admin panel. Kept free
// of React so the regression scripts can exercise them directly in Node.

export const buildPastQuestionsQuery = ({ institution = '', q = '' } = {}) => {
  const params = new URLSearchParams();
  if (String(institution).trim()) params.set('institution', String(institution).trim());
  if (String(q).trim()) params.set('q', String(q).trim());
  const qs = params.toString();
  return `/api/past-questions${qs ? `?${qs}` : ''}`;
};

export const listPaperYears = (papers = []) =>
  Array.from(new Set(papers.map((paper) => Number(paper.year)).filter(Number.isFinite)))
    .sort((a, b) => b - a);

/** Group papers by institution + course code, newest papers first. */
export const groupPapersByCourse = (papers = [], { year = '' } = {}) => {
  const groups = new Map();
  for (const paper of papers) {
    if (year && Number(paper.year) !== Number(year)) continue;
    const key = `${paper.institution}::${paper.courseCode}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        institution: paper.institution,
        courseCode: paper.courseCode,
        courseTitle: paper.courseTitle || '',
        papers: [],
      });
    }
    const group = groups.get(key);
    if (!group.courseTitle && paper.courseTitle) group.courseTitle = paper.courseTitle;
    group.papers.push(paper);
  }
  const list = Array.from(groups.values());
  for (const group of list) {
    group.papers.sort((a, b) => Number(b.year) - Number(a.year)
      || String(a.semester).localeCompare(String(b.semester)));
  }
  return list.sort((a, b) => a.institution.localeCompare(b.institution)
    || a.courseCode.localeCompare(b.courseCode));
};

export const describePaper = (paper) =>
  [paper?.year, paper?.semester, paper?.level ? `Level ${paper.level}` : '']
    .filter(Boolean)
    .join(' · ');

/**
 * Decide where "Practise as exam" lands after the server imports the paper
 * into the student's own materials.
 */
export const resolvePracticeOutcome = (result) => {
  const upload = result?.upload || null;
  if (upload?.courseId) {
    return {
      kind: 'ready',
      href: `/dashboard/exam?courseId=${encodeURIComponent(upload.courseId)}&start=1`,
    };
  }
  if (result?.processing || upload?.status === 'extracting' || upload?.status === 'pending') {
    return {
      kind: 'processing',
      href: '/dashboard/library',
      message: 'This paper is still being prepared. Find it in My Materials in a minute.',
    };
  }
  return {
    kind: 'error',
    message: upload?.errorMessage || 'We could not prepare this paper for practice. Try again later.',
  };
};

/**
 * Where the exam page stands on the course it was opened for: its quiz
 * questions are written after the text is extracted, so a freshly imported
 * paper can be listed before it is quiz-ready.
 * @returns {{ state: 'none'|'missing'|'preparing'|'ready', course: object|null }}
 */
export const resolvePreferredExamCourse = ({ courses = [], preferredCourseId = '' } = {}) => {
  if (!preferredCourseId) return { state: 'none', course: null };
  const course = (courses || []).find((item) => String(item?.id) === String(preferredCourseId)) || null;
  if (!course) return { state: 'missing', course: null };
  const quizReady = Number(course.quizzesReady || course.quizTopicCount || 0) > 0;
  return { state: quizReady ? 'ready' : 'preparing', course };
};
