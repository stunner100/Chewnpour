// Share of lesson sections finished: sections before the current one, or all of
// them once the lesson is marked complete. Entering a lesson is never 100%.
export const lessonSectionPercent = ({ sectionIndex = 0, sectionCount = 0, completed = false } = {}) => {
    const total = Math.max(0, Number(sectionCount) || 0);
    if (total === 0) return 0;
    if (completed) return 100;
    const finished = Math.min(total, Math.max(0, Number(sectionIndex) || 0));
    return Math.round((finished / total) * 100);
};
