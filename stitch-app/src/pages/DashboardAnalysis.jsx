import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction, useConvexAuth } from 'convex/react';
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
import {
    buildUploadLimitMessageFromOptions,
} from '../lib/pricingCurrency';
import { buildConceptPracticePath } from '../lib/conceptReviewLinks';

// ─── Referral CTA shown when credits are low ────────────────────────────────

const DashboardReferralCTA = ({ remaining, profile }) => {
    const normalizedRemaining = Number(remaining);
    if (!Number.isFinite(normalizedRemaining) || normalizedRemaining > 1 || !profile) return null;

    const referralCode = profile.referralCode || '';
    const referralLink = referralCode
        ? `https://www.chewnpour.com/signup?ref=${referralCode}`
        : '';

    if (!referralLink) return null;

    const handleShareWhatsApp = () => {
        const text = `Hey! Join me on Chew & Pour - the AI study app for Ghanaian students. Upload your notes and get AI-generated lessons and quizzes. Sign up with my link and we both get a free upload credit!\n\n${referralLink}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleShareTelegram = () => {
        const text = `Hey! Join me on Chew & Pour - the AI study app for Ghanaian students. Upload your notes and get AI-generated lessons and quizzes. Sign up with my link and we both get a free upload credit!`;
        window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="mt-4 w-full sm:w-72 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                {normalizedRemaining === 0 ? 'Out of uploads?' : 'Running low on uploads?'}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-2.5">
                Invite a friend and you both get a free upload credit!
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-[11px] font-bold hover:brightness-110 transition-all"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.291 0-4.42-.658-6.237-1.794l-.435-.27-2.642.886.886-2.642-.27-.435A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                    WhatsApp
                </button>
                <button
                    type="button"
                    onClick={handleShareTelegram}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0088cc] text-white text-[11px] font-bold hover:brightness-110 transition-all"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    Telegram
                </button>
            </div>
        </div>
    );
};


const isIgnorableProcessingDispatchError = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('connection lost while action was in flight');
};

const getConvexErrorCode = (error) => {
    const code = error?.data?.code;
    if (typeof code === 'string' && code.trim()) return code.trim().toUpperCase();

    const message = String(error?.message || '').trim();
    if (message.includes('UPLOAD_QUOTA_EXCEEDED')) return 'UPLOAD_QUOTA_EXCEEDED';
    if (/must be signed in/i.test(message)) return 'UNAUTHENTICATED';
    if (/do not have permission|permission to upload/i.test(message)) return 'UNAUTHORIZED';
    return '';
};

const isConvexAuthenticationError = (error) => {
    const code = getConvexErrorCode(error);
    if (code === 'UNAUTHENTICATED' || code === 'UNAUTHORIZED') return true;
    const message = String(error?.data?.message || error?.message || '').toLowerCase();
    return message.includes('must be signed in') || message.includes('permission to upload');
};

const getUploadAuthNotReadyMessage = () =>
    'Your session is still syncing. Please wait a few seconds and try again. If this continues, refresh and sign in again.';

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

const buildUploadLimitSubscriptionPath = () => {
    const query = new URLSearchParams({
        from: '/dashboard',
        reason: 'upload_limit',
    });
    return `/subscription?${query.toString()}`;
};

const STREAK_MILESTONES = [2, 3, 5, 7, 14, 30, 60, 100];

const getStreakStorageKey = (userId) => `streak_last_seen:${String(userId || '')}`;

const readLastSeenStreak = (userId) => {
    if (!userId || typeof window === 'undefined') return null;
    const rawValue = window.localStorage.getItem(getStreakStorageKey(userId));
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
};

const writeLastSeenStreak = (userId, streakDays) => {
    if (!userId || typeof window === 'undefined') return;
    window.localStorage.setItem(
        getStreakStorageKey(userId),
        String(Math.max(0, Math.floor(Number(streakDays) || 0)))
    );
};

const DashboardAnalysis = () => {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deletingCourseId, setDeletingCourseId] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [streakToastMessage, setStreakToastMessage] = useState('');
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const fileInputRef = useRef(null);
    const uploadInFlightRef = useRef(false);
    const lastSeenStreakRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isAuthenticated: isConvexAuthenticated } = useConvexAuth();

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex queries, mutations, and actions
    const courses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
    const userStats = useQuery(api.profiles.getUserStats, userId ? { userId } : 'skip');
    const performanceInsights = useQuery(
        api.exams.getUserPerformanceInsights,
        isConvexAuthenticated ? {} : 'skip'
    );
    const conceptReviewQueue = useQuery(
        api.concepts.getConceptReviewQueue,
        isConvexAuthenticated ? { limit: 6 } : 'skip'
    );
    const uploadQuota = useQuery(
        api.subscriptions.getUploadQuotaStatus,
        userId && isConvexAuthenticated ? {} : 'skip'
    );
    const uploadLimitMessage = useMemo(
        () => buildUploadLimitMessageFromOptions(
            uploadQuota?.topUpOptions,
            uploadQuota?.currency || 'GHS'
        ),
        [uploadQuota?.topUpOptions, uploadQuota?.currency]
    );
    const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : 'skip');
    const profile = useQuery(api.profiles.getProfile, userId && isConvexAuthenticated ? { userId } : 'skip');
    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createUpload = useMutation(api.uploads.createUpload);
    const createCourse = useMutation(api.courses.createCourse);
    const deleteCourse = useMutation(api.courses.deleteCourse);
    const processUploadedFile = useAction(api.ai.processUploadedFile);
    const submitFeedbackMutation = useMutation(api.feedback.submitFeedback);
    const autoJoinCommunity = useMutation(api.community.autoJoinOnUpload);

    useEffect(() => {
        lastSeenStreakRef.current = null;
        setStreakToastMessage('');
    }, [userId]);

    useEffect(() => {
        const currentStreak = Number(userStats?.streakDays);
        if (!userId || !Number.isFinite(currentStreak)) return;

        const normalizedCurrentStreak = Math.max(0, Math.floor(currentStreak));
        if (lastSeenStreakRef.current === null) {
            const storedStreak = readLastSeenStreak(userId);
            if (storedStreak === null) {
                lastSeenStreakRef.current = normalizedCurrentStreak;
                writeLastSeenStreak(userId, normalizedCurrentStreak);
                return;
            }
            lastSeenStreakRef.current = storedStreak;
        }

        const previousStreak = Number(lastSeenStreakRef.current);
        if (!Number.isFinite(previousStreak)) {
            lastSeenStreakRef.current = normalizedCurrentStreak;
            writeLastSeenStreak(userId, normalizedCurrentStreak);
            return;
        }

        if (normalizedCurrentStreak > previousStreak) {
            const reachedMilestones = STREAK_MILESTONES.filter(
                (milestone) => previousStreak < milestone && normalizedCurrentStreak >= milestone
            );

            if (reachedMilestones.length > 0) {
                const reachedMilestone = reachedMilestones[reachedMilestones.length - 1];
                setStreakToastMessage(
                    `Congrats! You've reached a ${reachedMilestone}-day streak. Keep going!`
                );
            }
        }

        if (normalizedCurrentStreak !== previousStreak) {
            lastSeenStreakRef.current = normalizedCurrentStreak;
            writeLastSeenStreak(userId, normalizedCurrentStreak);
        }
    }, [userId, userStats?.streakDays]);

    useEffect(() => {
        if (!streakToastMessage) return undefined;
        const timeoutId = window.setTimeout(() => {
            setStreakToastMessage('');
        }, 4200);
        return () => window.clearTimeout(timeoutId);
    }, [streakToastMessage]);

    useEffect(() => {
        const paywallToastMessage = location.state?.paywallToastMessage;
        if (!paywallToastMessage) return;

        setStreakToastMessage(String(paywallToastMessage));
        navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }, [location.pathname, location.search, location.state, navigate]);

    const redirectToUploadTopUp = () => {
        navigate(buildUploadLimitSubscriptionPath(), {
            state: {
                paywallMessage: uploadLimitMessage,
            },
        });
    };

    const handleFileSelect = async (e) => {
        const inputElement = e.target;
        const file = e.target.files?.[0];
        if (!file) return;

        if (uploadInFlightRef.current) {
            setUploadError('An upload is already in progress. Please wait for it to finish.');
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'upload_in_progress',
                userId,
                file,
            });
            if (inputElement) {
                inputElement.value = '';
            }
            return;
        }

        if (!userId) {
            setUploadError('Please log in to upload files');
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'missing_user',
                userId,
                file,
            });
            return;
        }

        if (!isConvexAuthenticated) {
            setUploadError(getUploadAuthNotReadyMessage());
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'convex_auth_not_ready',
                userId,
                file,
            });
            if (inputElement) {
                inputElement.value = '';
            }
            return;
        }

        // Validate file type
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (!validTypes.includes(file.type)) {
            setUploadError('Please upload a PDF, PPTX, or DOCX file');
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'unsupported_file_type',
                userId,
                file,
            });
            return;
        }

        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            setUploadError('File must be less than 50MB');
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'file_too_large',
                userId,
                file,
            });
            return;
        }

        if (uploadQuota && Number(uploadQuota.remaining) <= 0) {
            setUploadError(uploadLimitMessage);
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'upload_quota_exhausted_preflight',
                userId,
                file,
            });
            redirectToUploadTopUp();
            if (inputElement) {
                inputElement.value = '';
            }
            return;
        }

        const uploadObservation = createUploadObservation({
            flowType: 'study_material',
            source: 'dashboard_analysis',
            userId,
            file,
        });
        let currentStage = 'request_upload_url';
        setUploadError('');
        uploadInFlightRef.current = true;
        setUploading(true);
        reportUploadFlowStarted(uploadObservation);

        try {
            // Step 1: Get upload URL from Convex
            reportUploadStage(uploadObservation, currentStage);
            const uploadUrl = await generateUploadUrl();

            // Step 2: Upload file to Convex storage
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
                        'Upload to storage failed due to a temporary network issue. Retrying.',
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
                    'Upload to storage exhausted retries. Requesting a fresh upload URL and retrying once.',
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

            // Step 3: Create upload record
            currentStage = 'create_upload_record';
            reportUploadStage(uploadObservation, currentStage);
            const uploadId = await createUpload({
                userId,
                fileName: file.name,
                fileType: file.type.includes('pdf')
                    ? 'pdf'
                    : file.type.includes('wordprocessingml.document')
                        ? 'docx'
                        : 'pptx',
                fileSize: file.size,
                storageId,
            });

            // Step 4: Create a course from this upload
            currentStage = 'create_course';
            reportUploadStage(uploadObservation, currentStage);
            const courseId = await createCourse({
                userId,
                title: file.name.replace(/\.(pdf|pptx|docx)$/i, ''),
                description: 'Processing your study materials...',
                uploadId,
            });

            // Step 4b: Auto-create community channel and join user (fire-and-forget)
            autoJoinCommunity({ courseId, userId }).catch(() => {});

            // Step 5: Trigger AI processing in the background (don't await).
            // Dispatch before navigation so quick route transitions can't drop kickoff.
            // Note: server runs its own extraction pipeline; client-side extraction was removed
            // because the server never used the extractedText argument.
            currentStage = 'dispatch_ai_processing';
            reportUploadStage(uploadObservation, currentStage, { uploadId, courseId });
            processUploadedFile({ uploadId, courseId, userId, extractedText: '' }).catch((err) => {
                if (isIgnorableProcessingDispatchError(err)) {
                    reportUploadWarning(
                        uploadObservation,
                        'background_ai_processing',
                        'AI processing dispatch acknowledgement lost during a temporary connection drop',
                        {
                            uploadId,
                            courseId,
                            errorMessage: String(err?.message || err),
                        }
                    );
                    return;
                }

                console.error('AI processing failed:', err);
                reportUploadFlowFailed(uploadObservation, err, {
                    stage: 'background_ai_processing',
                    uploadId,
                    courseId,
                });
            });

            // Navigate to processing page immediately after kickoff dispatch.
            currentStage = 'navigate_processing_page';
            reportUploadStage(uploadObservation, currentStage, { courseId, uploadId });
            navigate(`/dashboard/processing/${courseId}`);

            reportUploadFlowCompleted(uploadObservation, {
                uploadId,
                courseId,
                processingDispatched: true,
                extractedTextLength: 0,
            });
        } catch (error) {
            console.error('Upload failed:', error);
            if (getConvexErrorCode(error) === 'UPLOAD_QUOTA_EXCEEDED') {
                setUploadError(
                    resolveQuotaExceededMessage(
                        error,
                        uploadQuota?.topUpOptions,
                        uploadQuota?.currency || 'GHS'
                    )
                );
                reportUploadValidationRejected({
                    flowType: 'study_material',
                    source: 'dashboard_analysis',
                    reason: 'upload_quota_exhausted_backend',
                    userId,
                    file,
                });
                redirectToUploadTopUp();
                return;
            }
            if (isConvexAuthenticationError(error)) {
                reportUploadWarning(
                    uploadObservation,
                    currentStage,
                    'Upload blocked because session auth is not ready.',
                    {
                        handledAs: 'auth_not_ready',
                        errorCode: getConvexErrorCode(error),
                        errorMessage: String(error?.data?.message || error?.message || ''),
                    }
                );
                setUploadError(getUploadAuthNotReadyMessage());
                return;
            }
            reportUploadFlowFailed(uploadObservation, error, { stage: currentStage });
            if (isTransientUploadTransportError(error)) {
                setUploadError('Upload failed due to a temporary network issue. Please check your connection and try again.');
            } else {
                setUploadError('Upload failed. Please try again.');
            }
        } finally {
            uploadInFlightRef.current = false;
            setUploading(false);
            if (inputElement) {
                inputElement.value = '';
            }
        }
    };

    const handleUploadClick = () => {
        if (uploadInFlightRef.current) return;
        fileInputRef.current?.click();
    };

    const handleDeleteCourse = async (course) => {
        if (!course?._id || !userId) return;

        setDeleteError('');
        setDeletingCourseId(String(course._id));

        try {
            await deleteCourse({ courseId: course._id, userId });
        } catch (error) {
            setDeleteError(error?.message || 'Could not delete this course right now. Please try again.');
        } finally {
            setDeletingCourseId('');
        }
    };

    const gradients = [
        '#7c3aed', // primary (violet)
        '#f43f5e', // secondary (rose)
        '#06b6d4', // accent-cyan
        '#10b981', // accent-emerald
    ];

    // Sort courses by creation date descending
    const displayCourses = React.useMemo(() => {
        if (!courses) return [];
        return showAllCourses ? courses : courses.slice(0, 3);
    }, [courses, showAllCourses]);

    const canToggleAllCourses = courses && courses.length > 3;

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/dashboard/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <div className="min-h-full font-body antialiased">
            {/* Top Bar */}
            <header className="sticky top-0 z-40 h-15 flex items-center justify-between gap-4 px-5 md:px-8 border-b border-border-subtle dark:border-border-subtle-dark bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-xl">
                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark truncate">Dashboard</h1>
                    {subscription && (
                        subscription.plan === 'premium' ? (
                            <span className="badge bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-700/30">Premium</span>
                        ) : (
                            <span className="badge bg-surface-hover dark:bg-surface-hover-dark text-text-faint-light dark:text-text-faint-dark">Free</span>
                        )
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Streak badge */}
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/15 border border-orange-200/50 dark:border-orange-800/30">
                        <span className="material-symbols-outlined text-orange-500 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
                        <span className="text-caption font-semibold text-orange-700 dark:text-orange-300">
                            {userStats?.streakDays || 0}d
                        </span>
                    </div>
                    {/* Search — desktop */}
                    <div className="hidden md:block relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">search</span>
                        <input
                            className="w-56 lg:w-72 pl-9 pr-3 py-2 rounded-xl bg-surface-hover dark:bg-surface-hover-dark border border-transparent focus:border-primary/20 focus:bg-surface-light dark:focus:bg-surface-dark text-body-sm placeholder:text-text-faint-light dark:placeholder:text-text-faint-dark transition-all focus:ring-2 focus:ring-primary/10"
                            placeholder="Search courses or topics..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                        />
                    </div>
                    {/* Profile link */}
                    <Link to="/profile" className="relative">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300">
                            {user?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent-emerald rounded-full border-2 border-surface-light dark:border-surface-dark"></div>
                    </Link>
                </div>
            </header>

            <div className="px-5 md:px-8 py-6 md:py-8 pb-24 md:pb-8 max-w-[1400px] space-y-6">
                {/* Mobile Search */}
                <div className="md:hidden relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">search</span>
                    <input
                        className="input-field pl-10"
                        placeholder="Search courses or topics..."
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                </div>

                {/* Hero Upload Section */}
                <div className="card-base p-6 md:p-8 animate-fade-in">
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-2">
                                <span className="badge-primary">
                                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                    AI Powered
                                </span>
                            </div>
                            <h2 className="text-display-md md:text-display-lg text-text-main-light dark:text-text-main-dark">
                                Upload your materials
                            </h2>
                            <p className="text-body-md text-text-sub-light dark:text-text-sub-dark max-w-lg">
                                Drop your PDFs, PowerPoints, or Word docs. AI transforms them into structured lessons with practice quizzes.
                            </p>
                            {uploadError && (
                                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/40 text-body-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">error</span>
                                    {uploadError}
                                </div>
                            )}
                            <div className="flex flex-col sm:flex-row items-start gap-3">
                                <input ref={fileInputRef} type="file" accept=".pdf,.pptx,.docx" className="hidden" disabled={uploading} onChange={handleFileSelect} />
                                <button onClick={handleUploadClick} disabled={uploading} className="btn-primary h-11 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {uploading ? 'hourglass_empty' : 'cloud_upload'}
                                    </span>
                                    {uploading ? 'Uploading...' : 'Upload Materials'}
                                </button>
                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark flex items-center gap-1 pt-1.5 sm:pt-3">
                                    PDF, PPTX, DOCX &middot; Max 50MB
                                </span>
                            </div>
                            {uploadQuota && (
                                <div className="max-w-xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-caption text-text-sub-light dark:text-text-sub-dark">
                                            {uploadQuota.remaining}/{uploadQuota.totalAllowed} uploads
                                        </span>
                                        <Link to={buildUploadLimitSubscriptionPath()} className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors">
                                            Top up
                                        </Link>
                                    </div>
                                    <div className="w-full h-1.5 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-[width] duration-500 ${
                                                uploadQuota.remaining === 0 ? 'bg-red-500'
                                                : uploadQuota.remaining <= 1 ? 'bg-amber-500'
                                                : 'bg-accent-emerald'
                                            }`}
                                            style={{ width: `${Math.round((uploadQuota.remaining / uploadQuota.totalAllowed) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <DashboardReferralCTA remaining={uploadQuota?.remaining} profile={profile} />
                        </div>
                        {/* Illustration */}
                        <div className="hidden md:flex items-center justify-center w-48">
                            <div className="w-36 h-36 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[56px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in-up animate-delay-100">
                    {[
                        { to: '/dashboard/assignment-helper', icon: 'edit_note', label: 'Assignments', desc: 'AI-powered answers', color: 'bg-primary' },
                        { to: '/dashboard/humanizer', icon: 'auto_fix_high', label: 'Humanizer', desc: 'Make AI text natural', color: 'bg-secondary', badge: 'New' },
                        { to: '/dashboard/community', icon: 'forum', label: 'Community', desc: 'Study with peers', color: 'bg-accent-teal', badge: 'New' },
                    ].map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className="group card-interactive p-4 flex items-center gap-3.5"
                        >
                            <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                                <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">{item.label}</span>
                                    {item.badge && <span className="text-overline text-primary">{item.badge}</span>}
                                </div>
                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark">{item.desc}</span>
                            </div>
                            <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                                arrow_forward
                            </span>
                        </Link>
                    ))}
                </div>

                {conceptReviewQueue && conceptReviewQueue.items.length > 0 && (
                    <section className="space-y-4 animate-fade-in-up animate-delay-150">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Review weak concepts</h2>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    {conceptReviewQueue.dueConceptCount > 0
                                        ? `${conceptReviewQueue.dueConceptCount} concepts are due for review across ${conceptReviewQueue.dueTopicCount} topics.`
                                        : 'Stay ahead by revisiting concepts before they fade.'}
                                </p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {conceptReviewQueue.items.map((item) => (
                                <Link
                                    key={item.topicId}
                                    to={buildConceptPracticePath(item.topicId, item.reviewConceptKeys)}
                                    className="group card-interactive p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${
                                                    item.dueCount > 0
                                                        ? 'bg-accent-amber/10 text-accent-amber'
                                                        : 'bg-primary/8 text-primary'
                                                }`}>
                                                    {item.dueCount > 0 ? `${item.dueCount} due` : 'Scheduled'}
                                                </span>
                                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                                    {item.weakCount} weak · {item.shakyCount} shaky · {item.strongCount} strong
                                                </span>
                                            </div>
                                            <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark line-clamp-1">
                                                {item.topicTitle}
                                            </h3>
                                            <p className="mt-2 text-caption text-text-sub-light dark:text-text-sub-dark line-clamp-2">
                                                {Array.isArray(item.concepts) && item.concepts.length > 0
                                                    ? item.concepts.map((concept) => concept.conceptLabel).join(' · ')
                                                    : 'Open a focused review session for this topic.'}
                                            </p>
                                        </div>
                                        <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                                            arrow_forward
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Upgrade Banner */}
                {subscription && subscription.plan !== 'premium' && (
                    <div className="card-base p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-primary-50 dark:bg-primary-900/15 border-primary-200/50 dark:border-primary-800/30 animate-fade-in-up animate-delay-150">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                            </div>
                            <div>
                                <p className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark">Unlock more uploads</p>
                                <p className="text-caption text-text-sub-light dark:text-text-sub-dark">Top up to keep learning without interruptions.</p>
                            </div>
                        </div>
                        <Link to="/subscription" className="btn-primary text-body-sm shrink-0">
                            Upgrade
                        </Link>
                    </div>
                )}

                {/* Courses */}
                <section className="animate-fade-in-up animate-delay-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Your courses</h2>
                        {canToggleAllCourses && (
                            <button
                                type="button"
                                onClick={() => setShowAllCourses((c) => !c)}
                                className="btn-ghost text-caption"
                            >
                                {showAllCourses ? 'Show less' : 'View all'}
                                <span className="material-symbols-outlined text-[16px]">{showAllCourses ? 'expand_less' : 'chevron_right'}</span>
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {displayCourses.length > 0 ? (
                            displayCourses.map((course, index) => {
                                const isCompleted = course.status === 'completed';
                                const progress = course.progress || 0;
                                const isExcellent = progress >= 80;
                                const isGood = progress >= 50;
                                return (
                                    <Link
                                        key={course._id}
                                        to={`/dashboard/course/${course._id}`}
                                        className="group card-interactive flex flex-col overflow-hidden"
                                    >
                                        <div className="relative w-full aspect-[16/9] overflow-hidden">
                                            {confirmDeleteId === course._id ? (
                                                <div
                                                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
                                                    className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg px-2.5 py-1.5 shadow-card"
                                                >
                                                    <span className="text-caption text-red-600 dark:text-red-400">Delete?</span>
                                                    <button
                                                        onClick={() => { handleDeleteCourse(course); setConfirmDeleteId(null); }}
                                                        disabled={deletingCourseId === String(course._id)}
                                                        className="text-caption font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
                                                    >Yes</button>
                                                    <button
                                                        onClick={() => setConfirmDeleteId(null)}
                                                        className="text-caption text-text-sub-light px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors"
                                                    >No</button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmDeleteId(course._id); }}
                                                    disabled={deletingCourseId === String(course._id)}
                                                    className="absolute top-2 right-2 z-20 btn-icon w-7 h-7 bg-surface-light/90 dark:bg-surface-dark/90 border border-border-subtle dark:border-border-subtle-dark opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                                    title="Delete course"
                                                    aria-label={`Delete ${course.title}`}
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {deletingCourseId === String(course._id) ? 'hourglass_empty' : 'delete'}
                                                    </span>
                                                </button>
                                            )}
                                            <div
                                                className="w-full h-full flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.03]"
                                                style={{ background: course.coverColor || gradients[index % gradients.length] }}
                                            >
                                                <span className="material-symbols-outlined text-white/90 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col p-3.5 gap-2.5 flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-overline ${isCompleted ? 'text-accent-emerald' : 'text-primary'}`}>
                                                    {isCompleted ? 'Completed' : 'In Progress'}
                                                </span>
                                                <span className={`text-caption font-semibold ${isExcellent ? 'text-accent-emerald' : isGood ? 'text-primary' : 'text-text-faint-light dark:text-text-faint-dark'}`}>
                                                    {progress}%
                                                </span>
                                            </div>
                                            <h3 className="text-body-sm font-semibold text-text-main-light dark:text-text-main-dark leading-snug line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
                                            <p className="text-caption text-text-faint-light dark:text-text-faint-dark line-clamp-2">{course.description}</p>
                                            <div className="w-full h-1 bg-border-subtle dark:bg-border-subtle-dark rounded-full overflow-hidden mt-auto">
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-500 ${isExcellent ? 'bg-accent-emerald' : isGood ? 'bg-primary' : 'bg-primary-300'}`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })
                        ) : (
                            <div className="col-span-full py-12 text-center card-flat">
                                <div className="w-14 h-14 rounded-2xl bg-surface-hover dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">school</span>
                                </div>
                                <h3 className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                                    {searchQuery.trim() ? 'No matching courses' : 'No courses yet'}
                                </h3>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mb-4 max-w-xs mx-auto">
                                    {searchQuery.trim() ? 'Try a different keyword.' : 'Upload your first study material to get started.'}
                                </p>
                                {!searchQuery.trim() && (
                                    <button type="button" onClick={handleUploadClick} disabled={uploading} className="btn-primary text-body-sm disabled:opacity-50 disabled:cursor-not-allowed">
                                        <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                                        Upload Now
                                    </button>
                                )}
                            </div>
                        )}
                        {/* Add new course tile */}
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={uploading}
                            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-light dark:border-border-dark text-text-faint-light dark:text-text-faint-dark hover:border-primary hover:text-primary hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all duration-200 cursor-pointer min-h-[200px] group disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <div className="w-11 h-11 rounded-xl bg-surface-hover dark:bg-surface-hover-dark flex items-center justify-center mb-2 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/30 transition-colors">
                                <span className="material-symbols-outlined text-xl">add</span>
                            </div>
                            <span className="text-body-sm font-semibold">Add Course</span>
                            <span className="text-caption mt-0.5">PDF, PPTX, DOCX</span>
                        </button>
                    </div>
                    {deleteError && (
                        <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/40 text-body-sm font-medium text-amber-800 dark:text-amber-300">
                            {deleteError}
                        </div>
                    )}
                </section>

                {/* Performance Insights */}
                {performanceInsights && (
                    <section className="space-y-4 animate-fade-in-up animate-delay-300">
                        <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Progress snapshot</h2>

                        <div className="card-base p-5 flex items-center gap-5">
                            <div className="relative w-14 h-14 shrink-0">
                                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-border-subtle dark:text-border-subtle-dark" />
                                    <circle
                                        cx="32" cy="32" r="26" fill="none" strokeWidth="5"
                                        strokeDasharray={`${(performanceInsights.overallPreparedness / 100) * 163.4} 163.4`}
                                        strokeLinecap="round"
                                        className={
                                            performanceInsights.overallPreparedness >= 80 ? 'text-accent-emerald stroke-current'
                                            : performanceInsights.overallPreparedness >= 50 ? 'text-primary stroke-current'
                                            : 'text-accent-amber stroke-current'
                                        }
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-body-sm font-bold text-text-main-light dark:text-text-main-dark">
                                    {performanceInsights.overallPreparedness}%
                                </span>
                            </div>
                            <div>
                                <p className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark">
                                    {performanceInsights.overallPreparedness >= 80 ? 'Exam Ready'
                                    : performanceInsights.overallPreparedness >= 50 ? 'Almost Ready'
                                    : 'Needs More Practice'}
                                </p>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                                    {performanceInsights.mastered.length} mastered &middot; {performanceInsights.progressing.length} progressing &middot; {performanceInsights.needsWork.length} needs work
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {performanceInsights.mastered.length > 0 && (
                                <div className="card-flat p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-accent-emerald text-[18px]">workspace_premium</span>
                                        <span className="text-overline text-accent-emerald">Strengths</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {performanceInsights.mastered.slice(0, 4).map((t) => (
                                            <li key={t.topicId} className="flex items-center justify-between gap-2">
                                                <span className="text-body-sm text-text-main-light dark:text-text-main-dark truncate">{t.title}</span>
                                                <span className="text-caption font-semibold text-accent-emerald shrink-0">{t.best}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {performanceInsights.needsWork.length > 0 && (
                                <div className="card-flat p-4 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-accent-amber text-[18px]">priority_high</span>
                                        <span className="text-overline text-accent-amber">Needs Attention</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {performanceInsights.needsWork.slice(0, 4).map((t) => (
                                            <li key={t.topicId} className="flex items-center justify-between gap-2">
                                                <span className="text-body-sm text-text-main-light dark:text-text-main-dark truncate">{t.title}</span>
                                                <Link to={`/dashboard/topic/${t.topicId}`} className="text-caption font-semibold text-primary hover:text-primary-hover transition-colors shrink-0">
                                                    Study
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Feedback */}
                <section className="animate-fade-in-up animate-delay-300">
                    <div className="card-base p-5 md:p-6">
                        {feedbackSubmitted ? (
                            <div className="text-center py-4">
                                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
                                    <span className="material-symbols-outlined text-2xl text-accent-emerald" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                </div>
                                <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">Thanks for your feedback!</h3>
                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">Your input helps us improve ChewnPour.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>rate_review</span>
                                    </div>
                                    <div>
                                        <h3 className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark">How's your experience?</h3>
                                        <p className="text-caption text-text-sub-light dark:text-text-sub-dark">We'd love to hear what you think</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mb-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFeedbackRating(star)}
                                            className="p-1 rounded-lg hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
                                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                        >
                                            <span
                                                className={`material-symbols-outlined text-2xl transition-colors ${star <= feedbackRating ? 'text-accent-amber' : 'text-border-light dark:text-border-dark hover:text-accent-amber/50'}`}
                                                style={star <= feedbackRating ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                            >star</span>
                                        </button>
                                    ))}
                                    {feedbackRating > 0 && (
                                        <span className="ml-2 text-caption font-semibold text-primary">
                                            {['', 'Needs work', 'Could be better', 'It\'s okay', 'Really good!', 'Love it!'][feedbackRating]}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder="What can we do better? Any features you'd love to see?"
                                    rows={3}
                                    className="input-field h-auto py-3 resize-none"
                                />
                                <div className="flex justify-end mt-3">
                                    <button
                                        type="button"
                                        disabled={(!feedbackText.trim() && feedbackRating === 0) || feedbackSubmitting}
                                        onClick={async () => {
                                            if (!userId) return;
                                            setFeedbackSubmitting(true);
                                            try {
                                                await submitFeedbackMutation({ userId, rating: feedbackRating || 0, message: feedbackText.trim() || undefined });
                                                setFeedbackSubmitted(true);
                                            } catch { setStreakToastMessage('Failed to send feedback. Please try again.'); }
                                            finally { setFeedbackSubmitting(false); }
                                        }}
                                        className="btn-primary text-body-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">{feedbackSubmitting ? 'hourglass_empty' : 'send'}</span>
                                        {feedbackSubmitting ? 'Sending...' : 'Send Feedback'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </div>
            <Toast message={streakToastMessage} onClose={() => setStreakToastMessage('')} />
        </div>
    );
};

export { DashboardAnalysis };
export default DashboardAnalysis;
