export const STUDY_MATERIAL_PROCESSING_ERROR_MESSAGE =
    "We couldn't finish turning this upload into study material. Try uploading a clearer source file.";

const INTERNAL_STUDY_MATERIAL_ERROR_PATTERNS = [
    /could not generate a valid word bank/i,
    /key ideas bullets/i,
    /word bank must include/i,
    /lesson sections are repeating/i,
];

export const getUserFacingUploadErrorMessage = (errorMessage = '') => {
    const normalizedMessage = String(errorMessage || '').trim();
    if (!normalizedMessage) return '';

    const isInternalStudyMaterialDiagnostic = INTERNAL_STUDY_MATERIAL_ERROR_PATTERNS.some((pattern) =>
        pattern.test(normalizedMessage)
    );

    return isInternalStudyMaterialDiagnostic
        ? STUDY_MATERIAL_PROCESSING_ERROR_MESSAGE
        : normalizedMessage;
};
