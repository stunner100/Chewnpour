// Pure helpers behind the in-lesson checks: grading retries, moving ordering
// steps without a mouse, and arrow-key focus in an answer radio group.

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Grades a submitted check, retrying a failed request after each delay. A
// submission already counts as attempted before grading starts, so a grading
// failure never blocks the lesson; it only delays feedback.
export const GRADE_RETRY_DELAYS_MS = [1000, 3000];

export const gradeWithRetry = async (grade, { delays = GRADE_RETRY_DELAYS_MS, wait = sleep } = {}) => {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await grade();
        } catch (error) {
            if (attempt >= delays.length) throw error;
            await wait(delays[attempt]);
        }
    }
};

// Moves the item at index by delta (-1 up, +1 down). Returns the same array
// when the move would leave the list.
export const moveStep = (items, index, delta) => {
    const target = index + delta;
    if (!Array.isArray(items) || index < 0 || index >= items.length || target < 0 || target >= items.length) {
        return items;
    }
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
};

export const moveAnnouncement = (text, position, total) =>
    `Moved "${text}" to position ${position} of ${total}.`;

// Radio group keyboard support (WAI-ARIA radio pattern): arrows move and
// select, wrapping at the ends; Home and End jump. Returns null for other keys.
export const nextRadioIndex = (current, key, count) => {
    if (count < 1) return null;
    const from = Number.isInteger(current) ? current : -1;
    if (key === 'ArrowDown' || key === 'ArrowRight') return (from + 1 + count) % count;
    if (key === 'ArrowUp' || key === 'ArrowLeft') return from < 0 ? count - 1 : (from - 1 + count) % count;
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    return null;
};

// Only one radio is in the tab order: the selected one, or the first.
export const radioTabIndex = (index, selectedIndex) =>
    (Number.isInteger(selectedIndex) ? index === selectedIndex : index === 0) ? 0 : -1;
