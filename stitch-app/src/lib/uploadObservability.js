import {
    addSentryBreadcrumb,
    captureSentryException,
    captureSentryMessage,
} from './sentry';
import { capturePostHogEvent } from './posthog';
import { isTransientUploadTransportError } from './uploadNetworkResilience';

const buildFlowId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const detectFileExtension = (fileName) => {
    const name = String(fileName || '').trim();
    const match = name.match(/\.([a-z0-9]+)$/i);
    return match ? match[1].toLowerCase() : 'unknown';
};

const getFileMeta = (file) => {
    if (!file) {
        return {
            fileMimeType: 'unknown',
            fileExtension: 'unknown',
            fileSizeBytes: 0,
        };
    }

    return {
        fileMimeType: String(file.type || 'unknown').toLowerCase(),
        fileExtension: detectFileExtension(file.name),
        fileSizeBytes: Number(file.size || 0),
    };
};

const toStringTags = (value) => {
    const tags = {};
    for (const [key, tagValue] of Object.entries(value || {})) {
        if (tagValue === undefined || tagValue === null || tagValue === '') continue;
        tags[key] = String(tagValue);
    }
    return tags;
};

const getElapsedMs = (startedAt) => {
    if (!Number.isFinite(startedAt)) return null;
    return Math.max(0, Date.now() - startedAt);
};

const getPostHogUploadProperties = (observation, extras = {}) => {
    return {
        flowId: observation?.flowId,
        flowType: observation?.flowType,
        source: observation?.source,
        userId: observation?.userId,
        fileMimeType: observation?.fileMimeType,
        fileExtension: observation?.fileExtension,
        fileSizeBytes: observation?.fileSizeBytes,
        uploadSizeBucket: getUploadSizeBucket(observation?.fileSizeBytes),
        elapsedMs: getElapsedMs(observation?.startedAt),
        ...extras,
    };
};

const LARGE_UPLOAD_WARNING_BYTES = 25 * 1024 * 1024;
const SLOW_UPLOAD_WARNING_MS = 90 * 1000;

const getUploadSizeBucket = (fileSizeBytes) => {
    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) return 'unknown';
    if (fileSizeBytes < 5 * 1024 * 1024) return 'small';
    if (fileSizeBytes < 25 * 1024 * 1024) return 'medium';
    return 'large';
};

export const createUploadObservation = ({ flowType, source, userId, file }) => {
    return {
        flowId: buildFlowId(),
        flowType: String(flowType || 'unknown'),
        source: String(source || 'unknown'),
        userId: userId ? String(userId) : undefined,
        startedAt: Date.now(),
        ...getFileMeta(file),
    };
};

export const reportUploadValidationRejected = ({ flowType, source, reason, userId, file }) => {
    const fileMeta = getFileMeta(file);

    addSentryBreadcrumb({
        category: 'upload',
        message: 'Upload validation rejected',
        level: 'warning',
        data: {
            reason,
            flowType,
            source,
            ...fileMeta,
        },
    });

    capturePostHogEvent('upload_validation_rejected', {
        flowType: String(flowType || 'unknown'),
        source: String(source || 'unknown'),
        reason: String(reason || 'unknown'),
        userId: userId ? String(userId) : undefined,
        ...fileMeta,
        uploadSizeBucket: getUploadSizeBucket(fileMeta.fileSizeBytes),
    });
};

export const reportUploadFlowStarted = (observation) => {
    if (!observation) return;

    const tags = toStringTags({
        area: 'upload',
        operation: 'flow_started',
        flowType: observation.flowType,
        source: observation.source,
        flowId: observation.flowId,
        fileExtension: observation.fileExtension,
    });
    const extras = {
        flowId: observation.flowId,
        userId: observation.userId,
        fileMimeType: observation.fileMimeType,
        fileExtension: observation.fileExtension,
        fileSizeBytes: observation.fileSizeBytes,
    };

    addSentryBreadcrumb({
        category: 'upload',
        message: 'Upload flow started',
        data: extras,
    });

    captureSentryMessage('Upload flow started', {
        level: 'info',
        tags,
        extras,
    });

    capturePostHogEvent('upload_flow_started', getPostHogUploadProperties(observation));

    if (observation.fileSizeBytes >= LARGE_UPLOAD_WARNING_BYTES) {
        captureSentryMessage('Large upload detected', {
            level: 'warning',
            tags: toStringTags({
                area: 'upload',
                operation: 'large_file_detected',
                flowType: observation.flowType,
                source: observation.source,
                flowId: observation.flowId,
                fileExtension: observation.fileExtension,
                uploadSizeBucket: getUploadSizeBucket(observation.fileSizeBytes),
            }),
            extras,
            fingerprint: [
                'upload-large-file-detected',
                String(observation.flowType || 'unknown'),
                String(observation.source || 'unknown'),
                String(observation.fileExtension || 'unknown'),
            ],
        });
        capturePostHogEvent('upload_large_detected', getPostHogUploadProperties(observation));
    }
};

export const reportUploadStage = (observation, stage, extras = {}) => {
    if (!observation || !stage) return;
    addSentryBreadcrumb({
        category: 'upload',
        message: `Upload stage: ${stage}`,
        data: {
            flowId: observation.flowId,
            flowType: observation.flowType,
            source: observation.source,
            stage,
            ...extras,
        },
    });
};

export const reportUploadWarning = (observation, stage, message, extras = {}) => {
    const tags = toStringTags({
        area: 'upload',
        operation: 'flow_warning',
        flowType: observation?.flowType,
        source: observation?.source,
        stage,
        flowId: observation?.flowId,
        fileExtension: observation?.fileExtension,
    });
    const payload = {
        flowId: observation?.flowId,
        userId: observation?.userId,
        fileMimeType: observation?.fileMimeType,
        fileExtension: observation?.fileExtension,
        fileSizeBytes: observation?.fileSizeBytes,
        elapsedMs: getElapsedMs(observation?.startedAt),
        ...extras,
    };

    addSentryBreadcrumb({
        category: 'upload',
        message: message || `Upload warning at ${stage}`,
        level: 'warning',
        data: payload,
    });

    captureSentryMessage(message || `Upload warning at ${stage}`, {
        level: 'warning',
        tags,
        extras: payload,
    });

    capturePostHogEvent('upload_flow_warning', getPostHogUploadProperties(observation, {
        stage,
        warningMessage: message || `Upload warning at ${stage}`,
        ...extras,
    }));
};

export const reportUploadFlowCompleted = (observation, extras = {}) => {
    if (!observation) return;
    const elapsedMs = getElapsedMs(observation.startedAt);
    const tags = toStringTags({
        area: 'upload',
        operation: 'flow_completed',
        flowType: observation.flowType,
        source: observation.source,
        flowId: observation.flowId,
        fileExtension: observation.fileExtension,
        uploadSizeBucket: getUploadSizeBucket(observation.fileSizeBytes),
    });
    const payload = {
        flowId: observation.flowId,
        userId: observation.userId,
        fileMimeType: observation.fileMimeType,
        fileExtension: observation.fileExtension,
        fileSizeBytes: observation.fileSizeBytes,
        elapsedMs,
        ...extras,
    };

    addSentryBreadcrumb({
        category: 'upload',
        message: 'Upload flow completed',
        data: payload,
    });

    captureSentryMessage('Upload flow completed', {
        level: 'info',
        tags,
        extras: payload,
    });

    capturePostHogEvent('upload_flow_completed', getPostHogUploadProperties(observation, extras));

    if (Number.isFinite(elapsedMs) && elapsedMs >= SLOW_UPLOAD_WARNING_MS) {
        captureSentryMessage('Upload flow slow', {
            level: 'warning',
            tags: toStringTags({
                area: 'upload',
                operation: 'flow_slow',
                flowType: observation.flowType,
                source: observation.source,
                flowId: observation.flowId,
                fileExtension: observation.fileExtension,
                uploadSizeBucket: getUploadSizeBucket(observation.fileSizeBytes),
            }),
            extras: payload,
            fingerprint: [
                'upload-flow-slow',
                String(observation.flowType || 'unknown'),
                String(observation.source || 'unknown'),
                String(observation.fileExtension || 'unknown'),
            ],
        });
        capturePostHogEvent('upload_flow_slow', getPostHogUploadProperties(observation, extras));
    }
};

export const reportUploadFlowFailed = (observation, error, { stage, ...extras } = {}) => {
    const transientTransport = isTransientUploadTransportError(error);
    const tags = toStringTags({
        area: 'upload',
        operation: 'flow_failed',
        flowType: observation?.flowType,
        source: observation?.source,
        stage,
        flowId: observation?.flowId,
        fileExtension: observation?.fileExtension,
        uploadSizeBucket: getUploadSizeBucket(observation?.fileSizeBytes),
        transientTransport: transientTransport ? 'yes' : 'no',
    });
    const payload = {
        flowId: observation?.flowId,
        userId: observation?.userId,
        fileMimeType: observation?.fileMimeType,
        fileExtension: observation?.fileExtension,
        fileSizeBytes: observation?.fileSizeBytes,
        elapsedMs: getElapsedMs(observation?.startedAt),
        ...extras,
    };

    addSentryBreadcrumb({
        category: 'upload',
        message: 'Upload flow failed',
        level: transientTransport ? 'warning' : 'error',
        data: payload,
    });

    captureSentryException(error, {
        level: transientTransport ? 'warning' : 'error',
        tags,
        extras: payload,
    });

    capturePostHogEvent('upload_flow_failed', getPostHogUploadProperties(observation, {
        stage,
        errorMessage: String(error?.message || error || 'unknown_error'),
        ...extras,
    }));
};
