export const classifyPostSignupPath = (pathname = '') => {
  const value = String(pathname || '');
  if (/\/dashboard(?:[/?#]|$)/i.test(value)) return 'dashboard';
  if (/\/onboarding\/department(?:[/?#]|$)/i.test(value)) return 'department';
  if (/\/onboarding\/level(?:[/?#]|$)/i.test(value)) return 'level';
  return 'unknown';
};

export const extractCourseIdFromDashboardUrl = (url = '') => {
  const match = String(url || '').match(/\/dashboard\/(?:processing|course)\/([^/?#]+)/i);
  return match?.[1] || null;
};
