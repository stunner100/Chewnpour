import { SECTION_TITLE_PATTERN } from './topicContentFormatting';

export const isReExplainQuotaExceededError = (error) => {
    const code = String(error?.data?.code || '').trim().toUpperCase();
    if (code === 'REEXPLAIN_QUOTA_EXCEEDED') return true;
    const message = String(error?.message || error?.data?.message || '').toUpperCase();
    return message.includes('REEXPLAIN_QUOTA_EXCEEDED');
};

export const SECTION_SETS = {
    quick_revision: ['big idea', 'key ideas', 'key ideas in simple words', 'key ideas in plain english', 'simple introduction', 'quick check', 'summary'],
    exam_prep: ['key ideas', 'key ideas in simple words', 'key ideas in plain english', 'common mistakes', 'common mistakes and misconceptions', 'worked example', 'worked examples', 'mini worked example', 'quick check', 'summary'],
    practice_only: null,
    full: null,
};
export const EMBEDDED_SECTION_SPLIT_PATTERN = new RegExp(`((?:^|\\s)(?:${SECTION_TITLE_PATTERN})\\s*(?:[:\\-]|\\b))`, 'i');
export const SECTION_TEXT_STRIP_PATTERN = /[^a-z\s]/g;
export const QUICK_CHECK_SECTION_PATTERN = /\bquick check\b/;
export const WORD_BANK_SECTION_PATTERN = /\b(word bank|glossary|quick glossary)\b/;
export const ANALOGY_SECTION_PATTERN = /\b(analog|everyday analog)\b/;
export const COMMON_MISTAKE_SECTION_PATTERN = /\b(common mistake|misconception)\b/;
export const STEP_TERM_PATTERN = /step/i;

export const buildTopicQuizRoute = (topicId) =>
    topicId ? `/dashboard/quiz/${topicId}?autostart=mcq` : '/dashboard';
export const buildEssayQuizRoute = (topicId) =>
    topicId ? `/dashboard/quiz/${topicId}?autostart=essay` : '/dashboard';
export const buildTimedExamRoute = (courseId) =>
    courseId ? `/dashboard/exam?courseId=${encodeURIComponent(courseId)}` : '/dashboard/exam';


export const getCurrentHashTargetId = () => {
    if (typeof window === 'undefined') return '';
    const rawHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (!rawHash) return '';
    try {
        return decodeURIComponent(rawHash).trim();
    } catch {
        return rawHash.trim();
    }
};

export const scrollHashTargetIntoView = ({ behavior = 'auto' } = {}) => {
    const targetId = getCurrentHashTargetId();
    if (!targetId) return false;
    const node = document.getElementById(targetId);
    if (!node) return false;
    node.scrollIntoView({ behavior, block: 'start' });
    return true;
};
