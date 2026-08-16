export const UPLOAD_READINESS_POLL_MS = 4000;

export const isUploadTerminal = (upload) => {
  const status = String(upload?.status || '').toLowerCase();
  return status === 'ready' || status === 'error';
};

export const isUploadStudyReady = (upload, course = null) => {
  const status = String(upload?.status || '').toLowerCase();
  const extraction = String(upload?.extractionStatus || '').toLowerCase();
  const courseId = course?.id || upload?.courseId || null;
  const topicCount = Number(
    course?.topicCount ?? upload?.topicCount ?? 0,
  );
  return (
    status === 'ready'
    && extraction === 'complete'
    && Boolean(courseId)
    && topicCount > 0
  );
};

export const uploadNeedsReadinessPoll = (upload, course = null) => {
  if (!upload) return false;
  const status = String(upload?.status || '').toLowerCase();
  if (status === 'error') return false;
  if (!isUploadTerminal(upload)) return true;
  const extraction = String(upload?.extractionStatus || '').toLowerCase();
  if (extraction !== 'complete') return true;
  if (!isUploadStudyReady(upload, course)) {
    // Ready extract but topics not linked yet — keep polling briefly.
    return status === 'ready';
  }
  return false;
};

export const listNeedsReadinessPoll = (uploads = [], courses = []) => {
  const courseByUploadId = new Map(
    (courses || [])
      .filter((course) => course?.uploadId)
      .map((course) => [String(course.uploadId), course]),
  );
  const courseById = new Map(
    (courses || []).map((course) => [String(course.id), course]),
  );
  return (uploads || []).some((upload) => {
    const course =
      courseByUploadId.get(String(upload.id))
      || (upload.courseId ? courseById.get(String(upload.courseId)) : null);
    return uploadNeedsReadinessPoll(upload, course);
  });
};

export const findNewlyStudyReadyUploads = ({
  previousUploads = [],
  nextUploads = [],
  previousCourses = [],
  nextCourses = [],
} = {}) => {
  const prevCourseByUploadId = new Map(
    (previousCourses || [])
      .filter((course) => course?.uploadId)
      .map((course) => [String(course.uploadId), course]),
  );
  const prevCourseById = new Map(
    (previousCourses || []).map((course) => [String(course.id), course]),
  );
  const nextCourseByUploadId = new Map(
    (nextCourses || [])
      .filter((course) => course?.uploadId)
      .map((course) => [String(course.uploadId), course]),
  );
  const nextCourseById = new Map(
    (nextCourses || []).map((course) => [String(course.id), course]),
  );

  const wasReady = new Set(
    (previousUploads || [])
      .filter((upload) => {
        const course =
          prevCourseByUploadId.get(String(upload.id))
          || (upload.courseId ? prevCourseById.get(String(upload.courseId)) : null);
        return isUploadStudyReady(upload, course);
      })
      .map((upload) => String(upload.id)),
  );

  return (nextUploads || []).filter((upload) => {
    const course =
      nextCourseByUploadId.get(String(upload.id))
      || (upload.courseId ? nextCourseById.get(String(upload.courseId)) : null);
    if (!isUploadStudyReady(upload, course)) return false;
    return !wasReady.has(String(upload.id));
  }).map((upload) => {
    const course =
      nextCourseByUploadId.get(String(upload.id))
      || (upload.courseId ? nextCourseById.get(String(upload.courseId)) : null);
    return {
      uploadId: upload.id,
      courseId: course?.id || upload.courseId,
      title: course?.title || upload.fileName || 'Your material',
      lessonsHref: `/dashboard/lessons?courseId=${encodeURIComponent(course?.id || upload.courseId)}`,
    };
  });
};

/**
 * Classify why quizzes/exams are empty.
 * @returns {'none'|'processing'|'topics_pending_quizzes'|'quiz_ready'}
 */
export const classifyStudyToolAvailability = ({
  uploads = [],
  courses = [],
} = {}) => {
  const uploadList = Array.isArray(uploads) ? uploads : [];
  const courseList = Array.isArray(courses) ? courses : [];

  const quizReady = courseList.some(
    (course) =>
      Boolean(course.firstQuizTopicId)
      || Number(course.quizzesReady || 0) > 0,
  );
  if (quizReady) return 'quiz_ready';

  if (uploadList.length === 0 && courseList.length === 0) {
    return 'none';
  }

  const anyProcessing = uploadList.some((upload) => {
    const status = String(upload.status || '').toLowerCase();
    const extraction = String(upload.extractionStatus || '').toLowerCase();
    if (status === 'error' || extraction === 'failed') return false;
    return status !== 'ready' || extraction !== 'complete';
  });
  if (anyProcessing) return 'processing';

  const topicsReady = courseList.some(
    (course) => Number(course.topicCount || 0) > 0,
  );
  if (topicsReady) return 'topics_pending_quizzes';

  // Uploads exist but no topics yet — treat as still generating.
  if (uploadList.length > 0) return 'processing';

  return 'none';
};

export const studyToolEmptyCopy = (state) => {
  switch (state) {
    case 'processing':
      return {
        title: 'Materials are still generating',
        description:
          'Your upload is processing. Open My Materials to watch progress, then return when quizzes are ready.',
        ctaLabel: 'Open My Materials',
        ctaHref: '/dashboard/library',
      };
    case 'topics_pending_quizzes':
      return {
        title: 'Lessons are ready — quizzes still generating',
        description:
          'Topics are available to study. Quiz questions appear shortly after lesson generation finishes.',
        ctaLabel: 'Open lessons',
        ctaHref: '/dashboard/lessons',
      };
    case 'none':
    default:
      return {
        title: 'Upload material to get started',
        description:
          'Add a PDF, slide deck, document, or audio file to generate lessons, quizzes, and timed exams.',
        ctaLabel: 'Upload Material',
        ctaHref: '/dashboard/upload',
      };
  }
};
