import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAction, useMutation, useQuery, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import Toast from '../components/Toast';
import {
    createUploadObservation,
    reportUploadFlowCompleted,
    reportUploadFlowFailed,
    reportUploadFlowStarted,
    reportUploadStage,
    reportUploadValidationRejected,
    reportUploadWarning,
} from '../lib/uploadObservability';
import {
    isTransientUploadTransportError,
    uploadToStorageWithRetry,
} from '../lib/uploadNetworkResilience';
import { ensurePromiseWithResolvers } from '../lib/runtimePolyfills';
import {
    buildUploadLimitMessageFromOptions,
} from '../lib/pricingCurrency';

let pdfWorkerInitialized = false;

const extractPdfTextFromFile = async (file) => {
    ensurePromiseWithResolvers();
    const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
    if (!pdfWorkerInitialized) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
        ).toString();
        pdfWorkerInitialized = true;
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const maxPages = Math.min(pdf.numPages, 20);
    let text = '';

    for (let i = 1; i <= maxPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item) => (typeof item.str === 'string' ? item.str : ''))
            .join(' ');
        text += `${pageText}\n`;
    }

    return text.trim();
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const isSupportedFileType = (file) => {
    if (!file || !file.type) return false;
    const type = file.type.toLowerCase();
    return type === 'application/pdf' || type === DOCX_MIME || type.startsWith('image/');
};

const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'just now';
    const delta = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (delta < minute) return 'just now';
    if (delta < hour) return `${Math.floor(delta / minute)}m ago`;
    if (delta < day) return `${Math.floor(delta / hour)}h ago`;
    return `${Math.floor(delta / day)}d ago`;
};

const getThreadStatusLabel = (status) => {
    if (status === 'ready') return 'Ready';
    if (status === 'error') return 'Failed';
    return 'Processing';
};



const PROCESSING_STAGES = [
    {
        title: 'Reading',
        detail: 'Identifying the subject and parsing each question.',
    },
    {
        title: 'Solving',
        detail: 'Working through each question step by step.',
    },
    {
        title: 'Finalizing',
        detail: 'Reviewing answers and preparing your results.',
    },
];

const normalizeAssistantDisplayText = (value) => {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\*\*([^*\n]+)\*\*/g, '$1')
        .replace(/__([^_\n]+)__/g, '$1')
        .replace(/`([^`\n]+)`/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*>\s?/gm, '')
        .replace(/(^|[\s(])\*([^*\n]+)\*([\s).,!?]|$)/g, '$1$2$3')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const ASSIGNMENT_QUESTIONS_MARKER = '__ASSIGNMENT_QUESTIONS_V1__';

const parseStructuredAnswers = (content) => {
    if (!content || typeof content !== 'string') return null;
    const markerIdx = content.indexOf(ASSIGNMENT_QUESTIONS_MARKER);
    if (markerIdx === -1) return null;
    try {
        const jsonStr = content.slice(markerIdx + ASSIGNMENT_QUESTIONS_MARKER.length);
        const parsed = JSON.parse(jsonStr);
        if (parsed?.questions?.length >= 2) return parsed;
    } catch { /* malformed JSON — fall back to prose */ }
    return null;
};

const FOLLOWUP_MAX_LENGTH = 4000;
const CONVEX_ERROR_WRAPPER_PATTERN = /\[CONVEX [^\]]+\]\s*\[Request ID:[^\]]+\]\s*/i;
const ASSIGNMENT_EXTRACTION_INSUFFICIENT_PATTERN = /could not extract enough text|upload a clearer image\/file/i;

const resolveConvexActionError = (error, fallbackMessage) => {
    const dataMessage = typeof error?.data === 'string'
        ? error.data
        : typeof error?.data?.message === 'string'
            ? error.data.message
            : '';
    const resolved = String(dataMessage || error?.message || fallbackMessage || '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!resolved) return fallbackMessage;

    const unwrapped = resolved
        .replace(CONVEX_ERROR_WRAPPER_PATTERN, '')
        .replace(/^Uncaught (ConvexError|Error):\s*/i, '')
        .replace(/^ConvexError:\s*/i, '')
        .replace(/^Server Error\s*/i, '')
        .replace(/Called by client$/i, '')
        .trim();

    return unwrapped || fallbackMessage;
};

const getConvexErrorCode = (error) => {
    const dataCode = error?.data?.code;
    if (typeof dataCode === 'string' && dataCode.trim()) return dataCode.trim().toUpperCase();

    const message = String(error?.message || '').trim();
    if (message.includes('UPLOAD_QUOTA_EXCEEDED')) return 'UPLOAD_QUOTA_EXCEEDED';
    if (message.includes('AI_MESSAGE_QUOTA_EXCEEDED')) return 'AI_MESSAGE_QUOTA_EXCEEDED';
    if (/must be signed in/i.test(message)) return 'UNAUTHENTICATED';
    if (/do not have permission|permission to upload/i.test(message)) return 'UNAUTHORIZED';
    return '';
};

const resolveQuotaExceededMessage = (error, fallbackTopUpOptions, fallbackCurrency = 'GHS') => {
    const topUpOptions = Array.isArray(error?.data?.topUpOptions)
        ? error.data.topUpOptions
        : fallbackTopUpOptions;
    if (Array.isArray(topUpOptions) && topUpOptions.length > 0) {
        const optionCurrency = String(error?.data?.currency || fallbackCurrency || 'GHS').toUpperCase();
        return buildUploadLimitMessageFromOptions(topUpOptions, optionCurrency);
    }

    const dataMessage = typeof error?.data?.message === 'string' ? error.data.message.trim() : '';
    if (dataMessage) return dataMessage;
    return buildUploadLimitMessageFromOptions(fallbackTopUpOptions, fallbackCurrency);
};

const isAssignmentExtractionInsufficientError = (error) => {
    const normalizedMessage = resolveConvexActionError(error, '').toLowerCase();
    if (!normalizedMessage) return false;
    return ASSIGNMENT_EXTRACTION_INSUFFICIENT_PATTERN.test(normalizedMessage);
};

const buildAssignmentExtractionGuidance = (error) => {
    const normalizedMessage = resolveConvexActionError(
        error,
        'We could not extract enough text from this assignment. Please upload a clearer image/file.'
    );
    return `${normalizedMessage} Make sure text is sharp, well-lit, and fully visible.`;
};

const isConvexAuthenticationError = (error) => {
    const code = getConvexErrorCode(error);
    if (code === 'UNAUTHENTICATED' || code === 'UNAUTHORIZED') return true;
    const message = String(error?.data?.message || error?.message || '').toLowerCase();
    return message.includes('must be signed in') || message.includes('permission to upload');
};

const getUploadAuthNotReadyMessage = () =>
    'Your session is still syncing. Please wait a few seconds and try again. If this continues, refresh and sign in again.';

const buildUploadLimitSubscriptionPath = () => {
    const query = new URLSearchParams({
        from: '/dashboard/assignment-helper',
        reason: 'upload_limit',
    });
    return `/subscription?${query.toString()}`;
};

const buildAiMessageLimitSubscriptionPath = () => {
    const query = new URLSearchParams({
        from: '/dashboard/assignment-helper',
        reason: 'ai_message_limit',
    });
    return `/subscription?${query.toString()}`;
};

const AssignmentHelper = () => {
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();
    const userId = user?.id;
    const location = useLocation();
    const navigate = useNavigate();

    const threads = useQuery(
        api.assignments.listThreads,
        userId ? { userId } : 'skip'
    );
    const uploadQuota = useQuery(
        api.subscriptions.getUploadQuotaStatus,
        userId && isConvexAuthenticated ? {} : 'skip'
    );
    const isUploadQuotaBypassed = Boolean(uploadQuota?.quotaBypassed);
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [busy, setBusy] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [paywallToastMessage, setPaywallToastMessage] = useState('');
    const [deletingThreadId, setDeletingThreadId] = useState('');
    const [processingStageIndex, setProcessingStageIndex] = useState(0);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [activeFollowUpQuestionNumber, setActiveFollowUpQuestionNumber] = useState(null);
    const [expandedQuestionIndex, setExpandedQuestionIndex] = useState(0);
    const uploadInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const endRef = useRef(null);
    const textareaRef = useRef(null);
    const pendingThreadIdRef = useRef(null);

    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createThreadFromUpload = useMutation(api.assignments.createThreadFromUpload);
    const deleteThread = useMutation(api.assignments.deleteThread);
    const processAssignmentThread = useAction(api.ai.processAssignmentThread);
    const askAssignmentFollowUp = useAction(api.ai.askAssignmentFollowUp);

    const selectedThreadPayload = useQuery(
        api.assignments.getThreadWithMessages,
        userId && selectedThreadId ? { userId, threadId: selectedThreadId } : 'skip'
    );
    const selectedThread = selectedThreadPayload?.thread || null;
    const messages = selectedThreadPayload?.messages || [];
    const threadStatus = selectedThread?.status || 'processing';
    const canAskFollowUp = Boolean(selectedThread && threadStatus === 'ready' && !sending && !busy);
    const isThreadProcessing = Boolean(selectedThread && threadStatus === 'processing');
    const showProcessingExperience = busy || isThreadProcessing;
    const currentProcessingStage = PROCESSING_STAGES[processingStageIndex] || PROCESSING_STAGES[0];
    const uploadLimitMessage = useMemo(
        () => buildUploadLimitMessageFromOptions(
            uploadQuota?.topUpOptions,
            uploadQuota?.currency || 'GHS'
        ),
        [uploadQuota?.topUpOptions, uploadQuota?.currency]
    );

    const sortedThreads = useMemo(() => threads || [], [threads]);

    useEffect(() => {
        if (!sortedThreads.length) {
            setSelectedThreadId(null);
            return;
        }
        // Protect the explicitly-set thread ID from being overridden by the sorted list
        if (pendingThreadIdRef.current && sortedThreads.some((t) => String(t._id) === String(pendingThreadIdRef.current))) {
            pendingThreadIdRef.current = null;
            return;
        }
        if (!selectedThreadId || !sortedThreads.some((thread) => String(thread._id) === String(selectedThreadId))) {
            setSelectedThreadId(sortedThreads[0]._id);
        }
    }, [sortedThreads, selectedThreadId]);

    useEffect(() => {
        if (!successMessage) return undefined;
        const timer = window.setTimeout(() => setSuccessMessage(''), 2500);
        return () => window.clearTimeout(timer);
    }, [successMessage]);

    useEffect(() => {
        if (!paywallToastMessage) return undefined;
        const timer = window.setTimeout(() => setPaywallToastMessage(''), 4200);
        return () => window.clearTimeout(timer);
    }, [paywallToastMessage]);

    useEffect(() => {
        if (!copiedMessageId) return undefined;
        const timer = window.setTimeout(() => setCopiedMessageId(null), 1500);
        return () => window.clearTimeout(timer);
    }, [copiedMessageId]);

    useEffect(() => {
        if (!confirmDeleteId) return undefined;
        const timer = window.setTimeout(() => setConfirmDeleteId(null), 3000);
        return () => window.clearTimeout(timer);
    }, [confirmDeleteId]);

    useEffect(() => {
        const incomingToastMessage = location.state?.paywallToastMessage;
        if (!incomingToastMessage) return;
        setPaywallToastMessage(String(incomingToastMessage));
        navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }, [location.pathname, location.search, location.state, navigate]);

    const redirectToUploadTopUp = () => {
        navigate(buildUploadLimitSubscriptionPath(), {
            state: {
                paywallMessage: uploadLimitMessage,
            },
        });
    };

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length, selectedThreadId, threadStatus]);

    useEffect(() => {
        if (!showProcessingExperience) {
            setProcessingStageIndex(0);
            return undefined;
        }

        const timer = window.setInterval(() => {
            setProcessingStageIndex((current) => {
                if (current >= PROCESSING_STAGES.length - 1) return current;
                return current + 1;
            });
        }, 2200);

        return () => window.clearInterval(timer);
    }, [showProcessingExperience, selectedThreadId]);

    const handleUploadClick = () => uploadInputRef.current?.click();
    const handleCameraClick = () => cameraInputRef.current?.click();

    const uploadAndProcessFile = async (file) => {
        if (!file) return;
        if (!userId) {
            reportUploadValidationRejected({
                flowType: 'assignment',
                source: 'assignment_helper',
                reason: 'missing_user',
                userId,
                file,
            });
            return;
        }
        if (!isConvexAuthenticated) {
            setError(getUploadAuthNotReadyMessage());
            reportUploadValidationRejected({
                flowType: 'assignment',
                source: 'assignment_helper',
                reason: 'convex_auth_not_ready',
                userId,
                file,
            });
            return;
        }
        setError('');
        setSuccessMessage('');

        if (!isSupportedFileType(file)) {
            setError('Unsupported file format. Upload a PDF, DOCX, or image file.');
            reportUploadValidationRejected({
                flowType: 'assignment',
                source: 'assignment_helper',
                reason: 'unsupported_file_type',
                userId,
                file,
            });
            return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            setError('File is too large. Maximum supported size is 50MB.');
            reportUploadValidationRejected({
                flowType: 'assignment',
                source: 'assignment_helper',
                reason: 'file_too_large',
                userId,
                file,
            });
            return;
        }

        if (!isUploadQuotaBypassed && uploadQuota && Number(uploadQuota.remaining) <= 0) {
            setError(uploadLimitMessage);
            reportUploadValidationRejected({
                flowType: 'assignment',
                source: 'assignment_helper',
                reason: 'upload_quota_exhausted_preflight',
                userId,
                file,
            });
            redirectToUploadTopUp();
            return;
        }

        const uploadObservation = createUploadObservation({
            flowType: 'assignment',
            source: 'assignment_helper',
            userId,
            file,
        });
        let currentStage = 'request_upload_url';
        setProcessingStageIndex(0);
        setBusy(true);
        reportUploadFlowStarted(uploadObservation);
        try {
            reportUploadStage(uploadObservation, currentStage);
            const uploadUrl = await generateUploadUrl();
            const uploadToStorageAttempt = async ({
                targetUploadUrl,
                maxAttempts,
                retryLabel,
            }) => uploadToStorageWithRetry({
                uploadUrl: targetUploadUrl,
                file,
                contentType: file.type,
                maxAttempts,
                onRetry: ({ attempt, maxAttempts: limit, delayMs, error }) => {
                    reportUploadWarning(
                        uploadObservation,
                        currentStage,
                        'Assignment upload hit a temporary network issue. Retrying.',
                        {
                            attempt,
                            maxAttempts: limit,
                            retryDelayMs: delayMs,
                            retryLabel,
                            errorMessage: String(error?.message || error || ''),
                        }
                    );
                },
            });

            let storageId;
            currentStage = 'upload_to_storage';
            reportUploadStage(uploadObservation, currentStage);
            try {
                storageId = await uploadToStorageAttempt({
                    targetUploadUrl: uploadUrl,
                    maxAttempts: 3,
                    retryLabel: 'initial',
                });
            } catch (storageUploadError) {
                if (!isTransientUploadTransportError(storageUploadError)) {
                    throw storageUploadError;
                }

                reportUploadWarning(
                    uploadObservation,
                    currentStage,
                    'Assignment upload exhausted retries. Requesting a fresh upload URL and retrying once.',
                    {
                        handledAs: 'refresh_upload_url_and_retry',
                        errorMessage: String(storageUploadError?.message || storageUploadError || ''),
                    }
                );

                currentStage = 'request_upload_url_retry';
                reportUploadStage(uploadObservation, currentStage);
                const retryUploadUrl = await generateUploadUrl();

                currentStage = 'upload_to_storage_retry';
                reportUploadStage(uploadObservation, currentStage);
                storageId = await uploadToStorageAttempt({
                    targetUploadUrl: retryUploadUrl,
                    maxAttempts: 2,
                    retryLabel: 'fresh_upload_url',
                });
            }

            currentStage = 'create_assignment_thread';
            reportUploadStage(uploadObservation, currentStage);
            const { threadId } = await createThreadFromUpload({
                userId,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                storageId,
            });

            pendingThreadIdRef.current = threadId;
            setSelectedThreadId(threadId);

            let extractedText = '';
            if (file.type === 'application/pdf') {
                currentStage = 'extract_pdf_text_preview';
                reportUploadStage(uploadObservation, currentStage, { threadId });
                try {
                    extractedText = await extractPdfTextFromFile(file);
                } catch (pdfError) {
                    console.warn('Client-side PDF extraction failed:', pdfError);
                    reportUploadWarning(
                        uploadObservation,
                        currentStage,
                        'Client-side assignment PDF text extraction failed',
                        {
                            threadId,
                            errorMessage: String(pdfError?.message || pdfError),
                        }
                    );
                }
            }

            currentStage = 'process_assignment_thread';
            reportUploadStage(uploadObservation, currentStage, { threadId });
            await processAssignmentThread({
                threadId,
                userId,
                extractedText: extractedText || undefined,
            });

            reportUploadFlowCompleted(uploadObservation, {
                threadId,
                extractedTextLength: extractedText.length,
            });
            setSuccessMessage('Assignment processed. You can ask follow-up questions now.');
        } catch (uploadError) {
            if (getConvexErrorCode(uploadError) === 'UPLOAD_QUOTA_EXCEEDED') {
                setError(
                    resolveQuotaExceededMessage(
                        uploadError,
                        uploadQuota?.topUpOptions,
                        uploadQuota?.currency || 'GHS'
                    )
                );
                reportUploadValidationRejected({
                    flowType: 'assignment',
                    source: 'assignment_helper',
                    reason: 'upload_quota_exhausted_backend',
                    userId,
                    file,
                });
                redirectToUploadTopUp();
                return;
            }
            if (isAssignmentExtractionInsufficientError(uploadError)) {
                console.warn('Assignment upload rejected due to insufficient extracted text:', uploadError);
                reportUploadWarning(
                    uploadObservation,
                    currentStage,
                    'Assignment processing could not extract enough text from the uploaded file.',
                    {
                        handledAs: 'user_correctable',
                        errorMessage: resolveConvexActionError(uploadError, ''),
                    }
                );
                setError(buildAssignmentExtractionGuidance(uploadError));
                return;
            }
            if (isConvexAuthenticationError(uploadError)) {
                reportUploadWarning(
                    uploadObservation,
                    currentStage,
                    'Assignment upload blocked because session auth is not ready.',
                    {
                        handledAs: 'auth_not_ready',
                        errorCode: getConvexErrorCode(uploadError),
                        errorMessage: resolveConvexActionError(uploadError, ''),
                    }
                );
                setError(getUploadAuthNotReadyMessage());
                return;
            }
            console.error('Assignment upload failed:', uploadError);
            reportUploadFlowFailed(uploadObservation, uploadError, { stage: currentStage });
            if (isTransientUploadTransportError(uploadError)) {
                setError('Upload failed due to a temporary network issue. Please check your connection and try again.');
            } else {
                setError(resolveConvexActionError(uploadError, 'Could not process assignment. Please try again.'));
            }
        } finally {
            setBusy(false);
        }
    };

    const handleFileInputChange = async (event) => {
        const file = event.target.files?.[0];
        await uploadAndProcessFile(file);
        event.target.value = '';
    };

    const handleDeleteThread = async (thread) => {
        if (!userId || !thread?._id) return;

        setDeletingThreadId(String(thread._id));
        setConfirmDeleteId(null);
        setError('');
        try {
            await deleteThread({
                userId,
                threadId: thread._id,
            });
            if (String(selectedThreadId) === String(thread._id)) {
                setSelectedThreadId(null);
            }
            setSuccessMessage('Thread deleted.');
        } catch (deleteError) {
            setError(resolveConvexActionError(deleteError, 'Could not delete this thread right now.'));
        } finally {
            setDeletingThreadId('');
        }
    };

    const handleSendFollowUp = async () => {
        if (!userId || !selectedThreadId || !canAskFollowUp) return;

        const question = followUpQuestion.trim();
        if (!question) return;

        setSending(true);
        setError('');
        try {
            const args = {
                threadId: selectedThreadId,
                userId,
                question,
            };
            if (activeFollowUpQuestionNumber) {
                args.questionNumber = activeFollowUpQuestionNumber;
            }
            await askAssignmentFollowUp(args);
            setFollowUpQuestion('');
            setActiveFollowUpQuestionNumber(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        } catch (followUpError) {
            if (getConvexErrorCode(followUpError) === 'AI_MESSAGE_QUOTA_EXCEEDED') {
                const paywallMessage = resolveConvexActionError(
                    followUpError,
                    "You've used your free AI messages today. Upgrade to premium for unlimited AI chat."
                );
                setError(paywallMessage);
                navigate(buildAiMessageLimitSubscriptionPath(), {
                    state: {
                        paywallMessage,
                    },
                });
                return;
            }
            setError(resolveConvexActionError(followUpError, 'Could not send follow-up question.'));
        } finally {
            setSending(false);
        }
    };

    const handleAskAboutQuestion = (qNum) => {
        setActiveFollowUpQuestionNumber(qNum);
        setFollowUpQuestion(`Regarding Question ${qNum}: `);
        textareaRef.current?.focus();
    };

    const handleCopy = async (content, messageId) => {
        try {
            await navigator.clipboard.writeText(content);
            setCopiedMessageId(messageId);
        } catch { /* clipboard not available */ }
    };

    const retryProcessing = async (thread) => {
        if (!thread || !userId || busy) return;
        setBusy(true);
        setError('');
        setProcessingStageIndex(0);
        try {
            await processAssignmentThread({
                threadId: thread._id,
                userId,
            });
            setSuccessMessage('Assignment reprocessed successfully.');
        } catch (retryError) {
            setError(resolveConvexActionError(retryError, 'Retry failed. Please try uploading again.'));
        } finally {
            setBusy(false);
        }
    };

    const onComposerKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendFollowUp();
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark antialiased min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 w-full bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard" aria-label="Back to dashboard" className="btn-icon w-10 h-10">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-[18px]">assignment</span>
                            </div>
                            <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Assignment Helper</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCameraClick}
                            disabled={busy}
                            aria-label="Take photo of assignment"
                            className="btn-secondary inline-flex items-center gap-1.5 h-9 px-3 text-body-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                            <span className="hidden sm:inline">Camera</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={busy}
                            aria-label="Upload assignment file"
                            className="btn-primary inline-flex items-center gap-1.5 h-9 px-3 text-body-sm"
                        >
                            <span className="material-symbols-outlined text-[18px]">{busy ? 'hourglass_empty' : 'upload_file'}</span>
                            <span className="hidden sm:inline">{busy ? 'Processing...' : 'Upload'}</span>
                        </button>
                    </div>
                </div>
            </header>

            <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,.docx,image/*"
                className="hidden"
                onChange={handleFileInputChange}
            />
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInputChange}
            />

            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6 md:px-6 md:py-8 pb-24 md:pb-8">
                {(error || successMessage) && (
                    <div className="mb-5 space-y-2">
                        {error && (
                            <div className="p-3 rounded-xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 text-body-sm font-medium text-red-700 dark:text-red-300">
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-accent-emerald/10 text-body-sm font-medium text-accent-emerald">
                                {successMessage}
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[72vh]">
                    <aside className={`lg:col-span-4 xl:col-span-3 card-base flex flex-col max-h-[60vh] lg:max-h-none overflow-hidden ${selectedThread ? 'hidden lg:flex' : ''}`}>
                        <div className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[18px]">forum</span>
                                <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Conversations</h2>
                            </div>
                            <span className="text-caption font-medium px-2 py-0.5 bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark rounded-full">{sortedThreads.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list">
                            {threads === undefined ? (
                                <div className="space-y-2">
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} className="animate-pulse rounded-xl bg-surface-hover-light dark:bg-surface-hover-dark h-20" />
                                    ))}
                                </div>
                            ) : sortedThreads.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                                    <div className="w-14 h-14 rounded-xl bg-primary/8 flex items-center justify-center mb-3">
                                        <span className="material-symbols-outlined text-[24px] text-primary/60">chat_add_on</span>
                                    </div>
                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">No assignments yet</p>
                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1 max-w-[200px]">Upload your first assignment to get started</p>
                                </div>
                            ) : (
                                sortedThreads.map((thread) => {
                                    const isActive = String(selectedThreadId) === String(thread._id);
                                    const isDeleting = deletingThreadId === String(thread._id);
                                    const isConfirmingDelete = confirmDeleteId === String(thread._id);
                                    return (
                                        <div
                                            key={thread._id}
                                            role="listitem"
                                            className={`group rounded-xl p-3 transition-all relative ${isActive
                                                ? 'bg-primary/5 dark:bg-primary/10 border-2 border-primary'
                                                : 'border border-border-light dark:border-border-dark hover:border-primary/30'
                                                } ${isDeleting ? 'opacity-50' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => !isDeleting && setSelectedThreadId(thread._id)}
                                                disabled={isDeleting}
                                                className="w-full text-left"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-primary text-white' : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark'}`}>
                                                        <span className="material-symbols-outlined text-[20px]">description</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-6">
                                                        <h3 className={`text-body-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-text-main-light dark:text-text-main-dark'}`}>
                                                            {thread.title}
                                                        </h3>
                                                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate mt-0.5">{thread.fileName}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${thread.status === 'ready'
                                                                ? 'bg-accent-emerald/10 text-accent-emerald'
                                                                : thread.status === 'error'
                                                                    ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                                                    : 'bg-accent-amber/10 text-accent-amber'
                                                                }`}>
                                                                {thread.status === 'ready' ? 'Ready' : thread.status === 'error' ? 'Failed' : 'Processing'}
                                                            </span>
                                                            <span className="text-[10px] text-text-faint-light dark:text-text-faint-dark">{formatRelativeTime(thread.updatedAt)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                            {isConfirmingDelete ? (
                                                <div className="absolute right-2 top-2 flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteThread(thread); setConfirmDeleteId(null); }}
                                                        className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                                        className="text-[10px] font-medium text-text-faint-light dark:text-text-faint-dark hover:text-text-main-light dark:hover:text-text-main-dark px-1.5 py-1 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setConfirmDeleteId(String(thread._id));
                                                    }}
                                                    disabled={isDeleting}
                                                    aria-label="Delete conversation"
                                                    className="absolute right-2 top-2 w-7 h-7 flex items-center justify-center rounded-lg text-text-faint-light dark:text-text-faint-dark hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {isDeleting ? 'hourglass_empty' : 'close'}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <section className="lg:col-span-8 xl:col-span-9 card-base flex flex-col h-[calc(100svh-10rem)] lg:h-[72vh] overflow-hidden">
                        {!selectedThread ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
                                <div className="mb-6">
                                    <div className="w-20 h-20 rounded-2xl bg-primary/8 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined text-[36px]">assignment</span>
                                    </div>
                                </div>
                                <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-2">Start with an Assignment</h2>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-xs mb-8">
                                    Upload a PDF, DOCX, or photo. Our AI will solve it and you can ask follow-up questions.
                                </p>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
                                    <button
                                        type="button"
                                        onClick={handleUploadClick}
                                        disabled={busy}
                                        className="btn-primary flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 px-6 text-body-sm"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">{busy ? 'hourglass_empty' : 'upload_file'}</span>
                                        Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCameraClick}
                                        disabled={busy}
                                        className="btn-secondary flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 px-6 text-body-sm"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                                        Take Photo
                                    </button>
                                </div>
                                <div className="mt-6 flex items-center gap-4 text-caption text-text-faint-light dark:text-text-faint-dark">
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                        PDF
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                        DOCX
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                        Images
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="px-4 py-3 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedThreadId(null)}
                                            className="lg:hidden btn-icon w-9 h-9"
                                            aria-label="Back to conversations"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                                        </button>
                                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shrink-0">
                                            <span className="material-symbols-outlined text-[18px]">description</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark truncate">{selectedThread.title}</h2>
                                            <div className="flex items-center gap-2">
                                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark truncate">{selectedThread.fileName}</p>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${threadStatus === 'ready'
                                                    ? 'bg-accent-emerald/10 text-accent-emerald'
                                                    : threadStatus === 'error'
                                                        ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                                        : 'bg-accent-amber/10 text-accent-amber'
                                                    }`}>
                                                    {threadStatus === 'ready' ? 'Ready' : threadStatus === 'error' ? 'Failed' : 'Processing'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {sortedThreads.length > 1 && (
                                        <div className="mt-3 lg:hidden">
                                            <label htmlFor="mobile-assignment-thread-switcher" className="sr-only">
                                                Switch assignment conversation
                                            </label>
                                            <div className="relative">
                                                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-text-faint-light dark:text-text-faint-dark">
                                                    swap_horiz
                                                </span>
                                                <select
                                                    id="mobile-assignment-thread-switcher"
                                                    aria-label="Switch assignment conversation"
                                                    value={selectedThreadId ? String(selectedThreadId) : ''}
                                                    onChange={(event) => setSelectedThreadId(event.target.value || null)}
                                                    className="input-field h-9 text-body-sm pl-8 pr-8"
                                                >
                                                    {sortedThreads.map((thread) => (
                                                        <option key={thread._id} value={String(thread._id)}>
                                                            {`${thread.title} (${getThreadStatusLabel(thread.status)})`}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">
                                                    expand_more
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-background-light dark:bg-background-dark">
                                    {isThreadProcessing && (
                                        <div className="card-base p-4 border-primary/20 dark:border-primary/20">
                                            <div className="flex items-start gap-3">
                                                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shrink-0">
                                                    <span className="material-symbols-outlined text-[18px] animate-pulse">auto_awesome</span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">AI is solving your assignment</p>
                                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-0.5">
                                                        {currentProcessingStage.detail}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center gap-2">
                                                {PROCESSING_STAGES.map((stage, index) => {
                                                    const isDone = index < processingStageIndex;
                                                    const isActive = index === processingStageIndex;
                                                    return (
                                                        <div key={stage.title} className="flex items-center gap-1.5">
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isDone
                                                                ? 'bg-accent-emerald/10 text-accent-emerald'
                                                                : isActive
                                                                    ? 'bg-primary text-white animate-pulse'
                                                                    : 'bg-surface-hover-light dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark'
                                                                }`}>
                                                                {isDone ? '✓' : index + 1}
                                                            </div>
                                                            {index < PROCESSING_STAGES.length - 1 && (
                                                                <div className={`w-6 h-0.5 ${isDone ? 'bg-accent-emerald/30' : 'bg-border-light dark:bg-border-dark'}`}></div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {messages.length === 0 && threadStatus === 'error' && (
                                        <div className="rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 px-4 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                                                </div>
                                                <div>
                                                    <p className="text-body-sm font-semibold text-red-700 dark:text-red-400">Processing Failed</p>
                                                    <p className="text-caption text-red-600 dark:text-red-300 mt-1">
                                                        {selectedThread.errorMessage || 'Could not process this assignment. Try uploading a clearer file or taking a better photo.'}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => retryProcessing(selectedThread)}
                                                        disabled={busy}
                                                        className="mt-3 inline-flex items-center gap-1.5 text-caption font-medium text-red-600 hover:text-red-700 dark:text-red-400 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                                                        Retry Processing
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {messages.length === 0 && threadStatus === 'processing' && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="w-14 h-14 rounded-2xl bg-surface-hover-light dark:bg-surface-hover-dark flex items-center justify-center mb-3">
                                                <span className="material-symbols-outlined text-[28px] text-text-faint-light dark:text-text-faint-dark animate-pulse">hourglass_empty</span>
                                            </div>
                                            <p className="text-body-sm font-medium text-text-sub-light dark:text-text-sub-dark">Assignment is being processed</p>
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1">Answers will appear here soon</p>
                                        </div>
                                    )}
                                    {messages.map((message, index) => {
                                        const isAssistant = message.role === 'assistant';
                                        const structured = isAssistant ? parseStructuredAnswers(message.content) : null;
                                        const displayContent = isAssistant && !structured
                                            ? (normalizeAssistantDisplayText(message.content) || message.content)
                                            : message.content;
                                        const showAvatar = index === 0 || messages[index - 1].role !== message.role;

                                        // Structured question-by-question accordion
                                        if (structured) {
                                            return (
                                                <div key={message._id} className="flex justify-start gap-2">
                                                    {showAvatar && (
                                                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0 mt-1">
                                                            <span className="material-symbols-outlined text-sm">smart_toy</span>
                                                        </div>
                                                    )}
                                                    <div className="max-w-[92%] md:max-w-[85%] space-y-2 w-full">
                                                        {structured.questions.map((q, qi) => {
                                                            const isOpen = expandedQuestionIndex === qi;
                                                            return (
                                                                <div
                                                                    key={qi}
                                                                    className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark overflow-hidden"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedQuestionIndex(isOpen ? -1 : qi)}
                                                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors"
                                                                    >
                                                                        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-caption font-bold flex items-center justify-center shrink-0">
                                                                            {q.number || qi + 1}
                                                                        </span>
                                                                        <span className="flex-1 text-body-sm font-medium text-text-main-light dark:text-text-main-dark truncate">
                                                                            {q.questionText || `Question ${q.number || qi + 1}`}
                                                                        </span>
                                                                        <span className={`material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[18px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                                                                            expand_more
                                                                        </span>
                                                                    </button>

                                                                    {isOpen && (
                                                                        <div className="px-4 pb-4 space-y-3 border-t border-border-light dark:border-border-dark">
                                                                            {q.questionText && (
                                                                                <p className="text-caption text-text-faint-light dark:text-text-faint-dark pt-3 italic">
                                                                                    {q.questionText}
                                                                                </p>
                                                                            )}
                                                                            <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 px-3 py-3">
                                                                                <p className="text-caption font-semibold text-primary mb-1">Answer</p>
                                                                                <div className="text-body-sm text-text-main-light dark:text-text-main-dark leading-relaxed whitespace-pre-wrap">
                                                                                    {q.answer}
                                                                                </div>
                                                                            </div>
                                                                            {q.workings && (
                                                                                <div className="rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark border border-border-light dark:border-border-dark px-3 py-3">
                                                                                    <p className="text-caption font-semibold text-text-faint-light dark:text-text-faint-dark mb-1">Workings</p>
                                                                                    <div className="text-caption text-text-sub-light dark:text-text-sub-dark leading-relaxed whitespace-pre-wrap font-mono">
                                                                                        {q.workings}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <div className="flex items-center gap-2 pt-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleAskAboutQuestion(q.number || qi + 1)}
                                                                                    className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 rounded-lg transition-colors"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[13px]">chat</span>
                                                                                    Ask about Q{q.number || qi + 1}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => navigate('/dashboard/humanizer', { state: { text: q.answer } })}
                                                                                    className="inline-flex items-center gap-1 text-caption font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-2.5 py-1.5 rounded-lg transition-colors"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[13px]">auto_fix_high</span>
                                                                                    Humanize
                                                                                </button>
                                                                                {(() => {
                                                                                    const copyId = `${message._id}-q${qi}`;
                                                                                    const isCopied = copiedMessageId === copyId;
                                                                                    return (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleCopy(q.answer + (q.workings ? `\n\nWorkings:\n${q.workings}` : ''), copyId)}
                                                                                            className={`inline-flex items-center gap-1 text-caption font-medium px-2.5 py-1.5 rounded-lg transition-colors ${isCopied
                                                                                                ? 'text-accent-emerald bg-accent-emerald/10'
                                                                                                : 'text-text-faint-light dark:text-text-faint-dark bg-surface-hover-light dark:bg-surface-hover-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                                                                                            }`}
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[13px]">{isCopied ? 'check' : 'content_copy'}</span>
                                                                                            {isCopied ? 'Copied!' : 'Copy'}
                                                                                        </button>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Prose fallback (original rendering)
                                        return (
                                            <div
                                                key={message._id}
                                                className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} gap-2`}
                                            >
                                                {isAssistant && showAvatar && (
                                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0 mt-1">
                                                        <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                                                    </div>
                                                )}
                                                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 whitespace-pre-wrap text-body-sm leading-relaxed ${isAssistant
                                                    ? 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-main-light dark:text-text-main-dark rounded-tl-sm'
                                                    : 'bg-primary text-white rounded-tr-sm'
                                                    }`}>
                                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                                        {displayContent.split('\n').map((paragraph, i) => (
                                                            <p key={i} className={i > 0 ? 'mt-2' : ''}>
                                                                {paragraph}
                                                            </p>
                                                        ))}
                                                    </div>
                                                    {isAssistant && displayContent && (
                                                        <div className="mt-3 pt-3 border-t border-border-light dark:border-border-dark flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate('/dashboard/humanizer', { state: { text: displayContent } })}
                                                                className="inline-flex items-center gap-1.5 text-caption font-medium text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                                                                Humanize
                                                            </button>
                                                            {(() => {
                                                                const isCopied = copiedMessageId === message._id;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCopy(displayContent, message._id)}
                                                                        className={`inline-flex items-center gap-1.5 text-caption font-medium px-3 py-1.5 rounded-lg transition-colors ${isCopied
                                                                            ? 'text-accent-emerald bg-accent-emerald/10'
                                                                            : 'text-text-faint-light dark:text-text-faint-dark bg-surface-hover-light dark:bg-surface-hover-dark hover:text-text-main-light dark:hover:text-text-main-dark'
                                                                        }`}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">{isCopied ? 'check' : 'content_copy'}</span>
                                                                        {isCopied ? 'Copied!' : 'Copy'}
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sending && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[92%] md:max-w-[80%] rounded-2xl px-4 py-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-white text-[12px]">smart_toy</span>
                                                    </div>
                                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                                        AI is thinking
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {[0, 1, 2].map((dot) => (
                                                            <span
                                                                key={dot}
                                                                className="h-1 w-1 rounded-full bg-primary animate-bounce"
                                                                style={{ animationDelay: `${dot * 150}ms` }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={endRef} />
                                </div>

                                <div className="px-4 py-3 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                                    {threadStatus === 'processing' ? (
                                        <div className="rounded-lg bg-surface-hover-light dark:bg-surface-hover-dark border border-border-light dark:border-border-dark px-3 py-3 flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[18px] animate-spin">refresh</span>
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                                Processing assignment... Chat will be available soon
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {activeFollowUpQuestionNumber && (
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                                        <span className="material-symbols-outlined text-[13px]">chat</span>
                                                        Asking about Q{activeFollowUpQuestionNumber}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setActiveFollowUpQuestionNumber(null); setFollowUpQuestion(''); }}
                                                        className="text-text-faint-light dark:text-text-faint-dark hover:text-text-main-light dark:hover:text-text-main-dark transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex items-end gap-2">
                                            <div className="flex-1 relative">
                                                <textarea
                                                    ref={(el) => {
                                                        textareaRef.current = el;
                                                        if (el) {
                                                            el.style.height = 'auto';
                                                            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                                                        }
                                                    }}
                                                    value={followUpQuestion}
                                                    onChange={(event) => {
                                                        setFollowUpQuestion(event.target.value);
                                                        event.target.style.height = 'auto';
                                                        event.target.style.height = Math.min(event.target.scrollHeight, 120) + 'px';
                                                    }}
                                                    onKeyDown={onComposerKeyDown}
                                                    placeholder={canAskFollowUp ? "Ask a follow-up question..." : "Chat disabled while processing"}
                                                    disabled={!canAskFollowUp}
                                                    aria-label="Follow-up question"
                                                    maxLength={FOLLOWUP_MAX_LENGTH}
                                                    className="input-field w-full resize-none px-4 py-3 pr-12 text-body-base min-h-[44px] max-h-[120px] overflow-y-auto disabled:opacity-50"
                                                    rows={1}
                                                />
                                                {followUpQuestion.length > FOLLOWUP_MAX_LENGTH * 0.8 && (
                                                    <span className={`absolute right-2 bottom-1 text-[10px] ${followUpQuestion.length >= FOLLOWUP_MAX_LENGTH ? 'text-red-500' : 'text-text-faint-light dark:text-text-faint-dark'}`}>
                                                        {followUpQuestion.length}/{FOLLOWUP_MAX_LENGTH}
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendFollowUp}
                                                disabled={!canAskFollowUp || !followUpQuestion.trim() || sending || followUpQuestion.length > FOLLOWUP_MAX_LENGTH}
                                                aria-label="Send follow-up question"
                                                className="btn-primary flex items-center justify-center w-11 h-11 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">{sending ? 'hourglass_empty' : 'send'}</span>
                                            </button>
                                        </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </main>
            <Toast message={paywallToastMessage} onClose={() => setPaywallToastMessage('')} />
        </div>
    );
};

export default AssignmentHelper;
