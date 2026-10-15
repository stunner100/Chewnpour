// The regenerate endpoint returns refreshed:false when it cannot find fresh
// questions and hands back the existing set; say so instead of implying
// the student is getting new questions.
export const describeQuizRefresh = (payload) => {
  if (!payload || !payload.topic) return null;
  if (payload.refreshed === true) {
    return { tone: 'success', message: 'New questions for this retry.' };
  }
  return {
    tone: 'info',
    message: 'We could not make new questions for this topic yet, so this retry uses the same questions.',
  };
};
