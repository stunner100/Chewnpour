export const isFirstTopicReady = ({ upload, hasTopics }) => {
    if (hasTopics) return true;
    if (!upload) return false;
    if (upload.processingStep === 'first_topic_ready') return true;
    if (typeof upload.generatedTopicCount === 'number' && upload.generatedTopicCount >= 1) {
        return true;
    }
    return false;
};

export const shouldAutoNavigateFromProcessing = ({
    upload,
    hasTopics,
    autoNavigated,
    resolvedCourseId,
}) => {
    if (!resolvedCourseId || autoNavigated || !upload) return false;
    const firstTopicReady = isFirstTopicReady({ upload, hasTopics });
    if (upload.status === 'ready') return true;
    if (upload.status === 'processing' && firstTopicReady) return true;
    if (upload.status === 'error' && firstTopicReady) return true;
    return false;
};

export const shouldShowProcessingConfirmation = ({
    upload,
    hasTopics,
}) => {
    if (!upload) return false;
    if (upload.status === 'error') return isFirstTopicReady({ upload, hasTopics });
    if (upload.status !== 'ready') return false;
    return isFirstTopicReady({ upload, hasTopics });
};
