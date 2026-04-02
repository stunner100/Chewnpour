const normalizeConceptReviewKey = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\s+/g, '_');

export const normalizeConceptReviewKeys = (values = []) =>
    Array.from(
        new Set(
            (Array.isArray(values) ? values : [])
                .map(normalizeConceptReviewKey)
                .filter(Boolean)
        )
    );

export const buildConceptPracticePath = (topicId, focusConceptKeys = []) => {
    const normalizedTopicId = String(topicId || '').trim();
    if (!normalizedTopicId) return '/dashboard/concept';

    const normalizedKeys = normalizeConceptReviewKeys(focusConceptKeys);
    if (normalizedKeys.length === 0) {
        return `/dashboard/concept/${normalizedTopicId}`;
    }

    const search = new URLSearchParams({
        review: normalizedKeys.join(','),
    });
    return `/dashboard/concept/${normalizedTopicId}?${search.toString()}`;
};

export const parseConceptReviewKeysFromSearchParams = (searchParams) =>
    normalizeConceptReviewKeys(
        String(searchParams?.get?.('review') || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
    );
