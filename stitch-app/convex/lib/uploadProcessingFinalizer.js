export const STALE_UPLOAD_REPAIR_TIMEOUT_MS = 90 * 60 * 1000;
export const STALE_UPLOAD_REPAIR_BATCH_SIZE = 25;

const SAFE_PROCESSING_FAILURE_MESSAGE =
  "We couldn't finish turning this upload into study material. Try uploading a clearer source file.";

const toCount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.floor(numeric);
};

const normalizeStep = (value) => String(value || "").trim().toLowerCase();

const isStaleUpload = ({ upload, now, staleAfterMs }) => {
  const createdAt = Number(upload?._creationTime || 0);
  if (!Number.isFinite(createdAt) || createdAt <= 0) return true;
  return now - createdAt > staleAfterMs;
};

const readyPatch = (reason, generatedTopicCount, plannedTopicCount) => ({
  action: "mark_ready",
  reason,
  patch: {
    status: "ready",
    processingStep: "ready",
    processingProgress: 100,
    generatedTopicCount,
    plannedTopicCount: Math.max(plannedTopicCount, generatedTopicCount),
    errorMessage: "",
  },
});

export const getUploadProcessingRepairDecision = ({
  upload,
  generatedTopicCount,
  plannedTopicCount,
  now = Date.now(),
  staleAfterMs = STALE_UPLOAD_REPAIR_TIMEOUT_MS,
}) => {
  if (String(upload?.status || "").toLowerCase() !== "processing") {
    return { action: "skip", reason: "not_processing", patch: {} };
  }

  const generated = Math.max(toCount(generatedTopicCount), toCount(upload?.generatedTopicCount));
  const planned = Math.max(toCount(plannedTopicCount), toCount(upload?.plannedTopicCount), generated);
  const step = normalizeStep(upload?.processingStep);

  if (!isStaleUpload({ upload, now, staleAfterMs })) {
    return { action: "keep_processing", reason: "not_stale", patch: {} };
  }

  if (generated > 0 && step === "ready") {
    return readyPatch("ready_step_recovered", generated, planned);
  }

  if (generated > 0 && planned > 0 && generated >= planned) {
    return readyPatch("completed_topics_recovered", generated, planned);
  }

  if (generated > 0 && step === "generating_question_bank") {
    return readyPatch("completed_topics_question_bank_removed", generated, planned);
  }

  if (generated > 0 && ["first_topic_ready", "generating_remaining_topics"].includes(step)) {
    return readyPatch("partial_topic_content_recovered", generated, planned);
  }

  return {
    action: "mark_error",
    reason: "stale_without_generated_content",
    patch: {
      status: "error",
      processingStep: "error",
      processingProgress: 0,
      generatedTopicCount: generated,
      plannedTopicCount: planned,
      errorMessage: SAFE_PROCESSING_FAILURE_MESSAGE,
    },
  };
};

