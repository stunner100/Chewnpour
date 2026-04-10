export function resolveCourseSourceStatus({
  linkStatus,
  uploadStatus,
  processingStep,
  processingProgress,
}) {
  const statuses = [linkStatus, uploadStatus].filter(Boolean);

  if (statuses.includes("error") || processingStep === "error") {
    return "error";
  }

  if (
    statuses.includes("ready")
    || processingStep === "ready"
    || (typeof processingProgress === "number" && processingProgress >= 100)
  ) {
    return "ready";
  }

  return "processing";
}
