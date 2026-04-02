import { ASSESSMENT_BLUEPRINT_VERSION } from "./assessmentBlueprint.js";

export const resolveExamAssessmentVersion = (value) =>
    String(value || ASSESSMENT_BLUEPRINT_VERSION).trim() || ASSESSMENT_BLUEPRINT_VERSION;

export const resolveTopicQuestionSetVersion = (topic) => {
    const explicitQuestionSetVersion = Number(topic?.questionSetVersion || 0);
    if (Number.isFinite(explicitQuestionSetVersion) && explicitQuestionSetVersion > 0) {
        return explicitQuestionSetVersion;
    }

    const readinessVersion = Number(topic?.examReadyUpdatedAt || 0);
    if (Number.isFinite(readinessVersion) && readinessVersion > 0) {
        return readinessVersion;
    }

    const createdAt = Number(topic?._creationTime || 0);
    if (Number.isFinite(createdAt) && createdAt > 0) {
        return createdAt;
    }

    return 0;
};

export const resolveExamSnapshotTimestamp = (snapshot) => {
    const finishedAt = Number(snapshot?.finishedAt || 0);
    if (Number.isFinite(finishedAt) && finishedAt > 0) {
        return finishedAt;
    }

    const startedAt = Number(snapshot?.startedAt || 0);
    if (Number.isFinite(startedAt) && startedAt > 0) {
        return startedAt;
    }

    const createdAt = Number(snapshot?._creationTime || 0);
    if (Number.isFinite(createdAt) && createdAt > 0) {
        return createdAt;
    }

    return 0;
};

export const isExamSnapshotCompatible = ({
    snapshotQuestionSetVersion,
    snapshotAssessmentVersion,
    topic,
    requestedAssessmentVersion,
    snapshotAt,
}) => {
    const currentQuestionSetVersion = resolveTopicQuestionSetVersion(topic);
    const currentAssessmentVersion = resolveExamAssessmentVersion(requestedAssessmentVersion);
    const normalizedSnapshotAssessmentVersion = String(snapshotAssessmentVersion || "").trim();

    if (
        normalizedSnapshotAssessmentVersion
        && normalizedSnapshotAssessmentVersion !== currentAssessmentVersion
    ) {
        return false;
    }

    if (currentQuestionSetVersion <= 0) {
        return true;
    }

    const normalizedSnapshotQuestionSetVersion = Number(snapshotQuestionSetVersion || 0);
    if (
        Number.isFinite(normalizedSnapshotQuestionSetVersion)
        && normalizedSnapshotQuestionSetVersion > 0
    ) {
        return normalizedSnapshotQuestionSetVersion === currentQuestionSetVersion;
    }

    const fallbackSnapshotAt = Number(snapshotAt || 0);
    if (Number.isFinite(fallbackSnapshotAt) && fallbackSnapshotAt > 0) {
        return fallbackSnapshotAt >= currentQuestionSetVersion;
    }

    return false;
};
