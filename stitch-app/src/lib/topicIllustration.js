export const DEFAULT_TOPIC_ILLUSTRATION_URL = "/topic-placeholder.svg";

export const resolveTopicIllustrationUrl = (illustrationUrl) => {
    if (typeof illustrationUrl === "string" && illustrationUrl.trim().length > 0) {
        return illustrationUrl;
    }
    return DEFAULT_TOPIC_ILLUSTRATION_URL;
};

export const isPlaceholderTopicIllustration = (illustrationUrl) => {
    const resolved = resolveTopicIllustrationUrl(illustrationUrl);
    return (
        resolved === DEFAULT_TOPIC_ILLUSTRATION_URL
        || resolved.endsWith('/topic-placeholder.svg')
        || resolved.includes('topic-placeholder.svg')
    );
};
