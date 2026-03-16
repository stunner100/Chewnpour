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
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col transition-colors duration-300">
            <header className="sticky top-0 z-50 w-full glass border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4 md:gap-8">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-[24px]">school</span>
                        </div>
                        <span className="text-xl font-display font-bold tracking-tight text-neutral-900 dark:text-white hidden sm:block">ChewnPour</span>
                    </div>
                    <div className="flex-1 max-w-xl hidden md:block">
                        <div className="relative group transition-transform duration-300 focus-within:scale-[1.01]">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
                            <input
                                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-primary/30 rounded-2xl focus:ring-4 focus:ring-primary/5 transition-colors text-sm font-medium placeholder-slate-400 shadow-sm"
                                placeholder="Search courses, topics, or questions..."
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-orange-200 dark:border-orange-800 select-none pointer-events-none">
                            <span className="material-symbols-outlined text-orange-500 text-[18px] filled animate-pulse">local_fire_department</span>
                            <span className="text-neutral-700 dark:text-neutral-200 text-xs font-bold">
                                {userStats?.streakDays || 0} Day Streak
                            </span>
                        </div>
                        <Link to="/profile" className="relative group block">
                            <div className="h-10 w-10 rounded-full p-0.5 bg-primary">
                                <div className="w-full h-full rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center overflow-hidden">
                                    <span className="text-primary font-bold text-sm">
                                        {user?.name?.[0]?.toUpperCase() || 'S'}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full"></div>
                        </Link>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 pb-20 md:px-6 md:py-12 md:pb-12">
                {/* Mobile Search Bar */}
                <div className="md:hidden w-full mb-6 relative group transition-transform duration-300 focus-within:scale-[1.01]">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
                    <input
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-primary/30 rounded-2xl focus:ring-4 focus:ring-primary/5 transition-colors text-base font-medium placeholder-slate-400 shadow-sm"
                        placeholder="Search courses or topics..."
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 flex flex-col animate-slide-up">
                        <div className="relative w-full h-full overflow-hidden rounded-3xl bg-surface-light dark:bg-surface-dark p-6 sm:p-8 md:p-10 shadow-soft border border-neutral-200/60 dark:border-neutral-800 group isolate">

                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between h-full gap-8">
                                <div className="flex-1 space-y-5">
                                    <span className="badge-primary">
                                        <span className="material-symbols-outlined text-sm filled">auto_awesome</span>
                                        AI Powered v2.0
                                    </span>
                                    {subscription && (
                                        subscription.plan === 'premium' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-amber-500/10 dark:bg-amber-500/20 px-3 py-1.5 rounded-full border border-amber-400/30">
                                                <span className="text-amber-500 text-xs">✦</span>
                                                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Premium</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                                                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Free Plan</span>
                                            </span>
                                        )
                                    )}
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-extrabold text-neutral-900 dark:text-white leading-[1.15] tracking-tight">
                                        Turn Your Slides into <br />
                                        <span className="text-primary">Smart Lessons & Quizzes</span>
                                    </h1>
                                    <p className="text-neutral-500 dark:text-neutral-400 text-base md:text-lg font-medium leading-relaxed max-w-lg">
                                        Upload PDFs, PowerPoints, or Word docs. Our AI transforms them into bite-sized lessons with practice quizzes.
                                    </p>
                                    <div className="pt-2">
                                        {uploadError && (
                                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                                                {uploadError}
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.pptx,.docx"
                                            className="hidden"
                                            disabled={uploading}
                                            onChange={handleFileSelect}
                                        />
                                        <button
                                            onClick={handleUploadClick}
                                            disabled={uploading}
                                            className="btn-primary flex items-center justify-center gap-2 h-12 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-fit"
                                        >
                                            <span className="material-symbols-outlined text-[22px] filled">
                                                {uploading ? 'hourglass_empty' : 'cloud_upload'}
                                            </span>
                                            {uploading ? 'Uploading...' : 'Upload Materials'}
                                        </button>
                                        <p className="mt-3 text-xs font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px] text-green-500">verified</span>
                                            Secure • PDF, PPTX, DOCX • Max 50MB
                                        </p>
                                        {uploadQuota && (
                                            <div className="mt-4 w-full sm:w-72">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                                        {uploadQuota.remaining} of {uploadQuota.totalAllowed} uploads remaining
                                                    </span>
                                                    <Link
                                                        to={buildUploadLimitSubscriptionPath()}
                                                        className="text-[11px] font-bold text-primary hover:text-primary-hover"
                                                    >
                                                        Top up now
                                                    </Link>
                                                </div>
                                                <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-[width] duration-500 ${uploadQuota.remaining === 0
                                                            ? 'bg-red-500'
                                                            : uploadQuota.remaining <= 1
                                                                ? 'bg-amber-500'
                                                                : 'bg-green-500'
                                                            }`}
                                                        style={{ width: `${Math.round((uploadQuota.remaining / uploadQuota.totalAllowed) * 100)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                        <DashboardReferralCTA remaining={uploadQuota?.remaining} profile={profile} />
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center justify-center relative w-1/3">
                                    <div className="w-48 h-48 bg-surface-light dark:bg-surface-dark rounded-[2rem] flex items-center justify-center shadow-card relative z-10 rotate-3 border border-neutral-200/50 dark:border-neutral-700/50">
                                        <div className="absolute inset-2 bg-primary/5 rounded-[1.75rem]"></div>
                                        <span className="material-symbols-outlined text-[64px] text-primary relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4 flex flex-col h-full animate-slide-up animate-delay-100 space-y-4">
                        <Link to="/dashboard/assignment-helper" className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-primary p-5 sm:p-6 shadow-lg shadow-primary/20 transition-shadow duration-300 cursor-pointer group hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-1">
                            <div className="relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white mb-4">
                                    <span className="material-symbols-outlined text-[28px] filled">assignment</span>
                                </div>
                                <h2 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight leading-tight mb-2">
                                    Assignment Helper
                                </h2>
                                <p className="text-white/80 text-sm leading-relaxed">
                                    Upload assignment sheets and get AI-powered answers with chat.
                                </p>
                            </div>
                            <div className="relative z-10 mt-4">
                                <div className="flex items-center gap-2 text-white font-semibold text-sm group-hover:gap-3 transition-all">
                                    <span>Open</span>
                                    <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </div>
                            </div>
                        </Link>
                        <Link to="/dashboard/humanizer" className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-secondary p-5 sm:p-6 shadow-lg shadow-secondary/20 transition-shadow duration-300 cursor-pointer group hover:shadow-xl hover:shadow-secondary/30 hover:-translate-y-1">
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                        <span className="material-symbols-outlined text-[28px] filled">auto_fix_high</span>
                                    </div>
                                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] font-bold text-white uppercase tracking-wider">New</span>
                                </div>
                                <h2 className="text-xl md:text-2xl font-display font-bold text-white tracking-tight leading-tight mb-2">
                                    AI Humanizer
                                </h2>
                                <p className="text-white/80 text-sm leading-relaxed">
                                    Make AI text sound human and bypass detection tools.
                                </p>
                            </div>
                            <div className="relative z-10 mt-4">
                                <div className="flex items-center gap-2 text-white font-semibold text-sm group-hover:gap-3 transition-all">
                                    <span>Try it</span>
                                    <span className="material-symbols-outlined text-lg group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                    {/* Upgrade Banner for Free Users */}
                    {subscription && subscription.plan !== 'premium' && (
                        <div className="col-span-1 lg:col-span-12 animate-slide-up animate-delay-150">
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-violet-600 to-fuchsia-600 p-5 sm:p-6 shadow-lg shadow-primary/20">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-2xl text-white filled">rocket_launch</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-display font-bold text-white">Unlock More Uploads</h3>
                                            <p className="text-white/80 text-sm">You're on the Free Plan with limited uploads. Top up to keep learning without interruptions.</p>
                                        </div>
                                    </div>
                                    <Link
                                        to="/subscription"
                                        className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-white text-primary rounded-xl text-sm font-bold shadow-lg hover:bg-white/90 hover:-translate-y-0.5 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-lg filled">diamond</span>
                                        Upgrade Now
                                    </Link>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="col-span-1 lg:col-span-12 mt-2 animate-slide-up animate-delay-200">
                        <div className="flex items-center justify-between mb-6 px-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                    <span className="material-symbols-outlined text-xl filled">history</span>
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-display font-bold text-neutral-900 dark:text-white tracking-tight">Continue Learning</h2>
                                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">Pick up where you left off</p>
                                </div>
                            </div>
                            {canToggleAllCourses && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllCourses((current) => !current)}
                                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-600 dark:text-neutral-300 text-xs font-bold transition-colors"
                                    aria-label={showAllCourses ? 'Show fewer courses' : 'View all courses'}
                                >
                                    {showAllCourses ? 'Show less' : 'View all'}
                                    <span className="material-symbols-outlined text-[16px]">
                                        {showAllCourses ? 'expand_less' : 'chevron_right'}
                                    </span>
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                            className="group flex flex-col bg-white dark:bg-surface-dark rounded-2xl overflow-hidden shadow-sm border border-neutral-200/60 dark:border-neutral-800 hover:shadow-xl hover:shadow-slate-200/30 dark:hover:shadow-black/30 hover:-translate-y-1 transition-shadow duration-300 cursor-pointer h-full"
                                        >
                                            <div className="relative w-full aspect-[16/10] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                                                {confirmDeleteId === course._id ? (
                                                    <div
                                                        onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
                                                        className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 shadow-sm"
                                                    >
                                                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">Delete?</span>
                                                        <button
                                                            onClick={() => { handleDeleteCourse(course); setConfirmDeleteId(null); }}
                                                            disabled={deletingCourseId === String(course._id)}
                                                            className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 px-2 py-0.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-60"
                                                        >Yes</button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 px-2 py-0.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                                        >Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            setConfirmDeleteId(course._id);
                                                        }}
                                                        disabled={deletingCourseId === String(course._id)}
                                                        className="absolute top-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
                                                        title="Delete course"
                                                        aria-label={`Delete ${course.title}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            {deletingCourseId === String(course._id) ? 'hourglass_empty' : 'delete'}
                                                        </span>
                                                    </button>
                                                )}
                                                <div
                                                    className="w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105"
                                                    style={{ background: course.coverColor || gradients[index % gradients.length] }}
                                                >
                                                    <span className="material-symbols-outlined text-white text-4xl drop-shadow-lg" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                                                </div>
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                            <div className="flex flex-col p-4 gap-3">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${isCompleted
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                        }`}>
                                                        {isCompleted ? 'Completed' : 'In Progress'}
                                                    </span>
                                                    <span className={`text-xs font-bold ${isExcellent ? 'text-green-600' : isGood ? 'text-blue-600' : 'text-neutral-400'}`}>
                                                        {progress}%
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-tight mb-1 line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
                                                    <p className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-2">{course.description}</p>
                                                </div>
                                                <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-[width] duration-500 ${isExcellent ? 'bg-green-500' : isGood ? 'bg-blue-500' : 'bg-primary'}`}
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-neutral-400">
                                        <span className="material-symbols-outlined text-3xl">school</span>
                                    </div>
                                    <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">
                                        {searchQuery.trim() ? 'No matching courses' : 'No courses yet'}
                                    </h3>
                                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-4 max-w-xs mx-auto">
                                        {searchQuery.trim()
                                            ? 'Try a different keyword or press Enter to search.'
                                            : 'Upload your first study material to get started!'}
                                    </p>
                                    {!searchQuery.trim() && (
                                        <button
                                            type="button"
                                            onClick={handleUploadClick}
                                            disabled={uploading}
                                            className="inline-flex items-center gap-1 px-4 py-2 bg-primary text-white text-sm font-bold rounded-full hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                            Upload Now
                                        </button>
                                    )}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleUploadClick}
                                disabled={uploading}
                                className="flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors duration-300 cursor-pointer min-h-[220px] group h-full disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-neutral-300 disabled:hover:bg-neutral-50 disabled:hover:text-neutral-500"
                            >
                                <div className="w-14 h-14 rounded-xl bg-white dark:bg-neutral-800 shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-2xl text-primary">add</span>
                                </div>
                                <span className="font-bold text-base">Add New Course</span>
                                <span className="text-xs text-neutral-400 mt-1">PDF, PPTX, DOCX</span>
                            </button>
                        </div>
                        {deleteError && (
                            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                {deleteError}
                            </div>
                        )}
                    </div>
                </div>
                {/* Performance Insights panel — visible once user has exam history */}
                {performanceInsights && (
                    <div className="mt-8 animate-slide-up animate-delay-300">
                        <div className="flex items-center gap-3 mb-6 px-1">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-xl filled">insights</span>
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-display font-bold text-neutral-900 dark:text-white tracking-tight">Your Progress Snapshot</h2>
                                <p className="text-neutral-500 dark:text-neutral-400 text-sm">Based on your exam history</p>
                            </div>
                        </div>

                        {/* Preparedness gauge */}
                        <div className="mb-6 bg-white dark:bg-surface-dark rounded-2xl border border-neutral-200/60 dark:border-neutral-800 p-5 flex items-center gap-5 shadow-sm">
                            <div className="relative w-16 h-16 shrink-0">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" className="text-neutral-100 dark:text-neutral-800" />
                                    <circle
                                        cx="32" cy="32" r="26" fill="none" strokeWidth="6"
                                        strokeDasharray={`${(performanceInsights.overallPreparedness / 100) * 163.4} 163.4`}
                                        strokeLinecap="round"
                                        className={
                                            performanceInsights.overallPreparedness >= 80
                                                ? 'text-green-500 stroke-current'
                                                : performanceInsights.overallPreparedness >= 50
                                                    ? 'text-blue-500 stroke-current'
                                                    : 'text-amber-500 stroke-current'
                                        }
                                    />
                                </svg>
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-neutral-900 dark:text-white">
                                    {performanceInsights.overallPreparedness}%
                                </span>
                            </div>
                            <div>
                                <p className="text-base font-bold text-neutral-900 dark:text-white">
                                    {performanceInsights.overallPreparedness >= 80
                                        ? 'Exam Ready'
                                        : performanceInsights.overallPreparedness >= 50
                                            ? 'Almost Ready'
                                            : 'Needs More Practice'}
                                </p>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                                    {performanceInsights.mastered.length} mastered · {performanceInsights.progressing.length} progressing · {performanceInsights.needsWork.length} needs work
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Strengths */}
                            {performanceInsights.mastered.length > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-green-600 text-[20px]">workspace_premium</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Your Strengths</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {performanceInsights.mastered.slice(0, 4).map((t) => (
                                            <li key={t.topicId} className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</span>
                                                <span className="shrink-0 text-xs font-bold text-green-600 dark:text-green-400">{t.best}%</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Needs Attention */}
                            {performanceInsights.needsWork.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-amber-600 text-[20px]">priority_high</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Needs Attention</span>
                                    </div>
                                    <ul className="space-y-2">
                                        {performanceInsights.needsWork.slice(0, 4).map((t) => (
                                            <li key={t.topicId} className="flex items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.title}</span>
                                                <Link
                                                    to={`/dashboard/topic/${t.topicId}`}
                                                    className="shrink-0 text-xs font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-2"
                                                >
                                                    Study Now
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* Feedback Form */}
                <div className="mt-10 animate-slide-up animate-delay-300">
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-violet-50 to-fuchsia-50 dark:from-primary/10 dark:via-violet-900/10 dark:to-fuchsia-900/10 border-2 border-primary/20 dark:border-primary/30 p-6 sm:p-8 shadow-lg shadow-primary/5">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-500/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
                        {feedbackSubmitted ? (
                            <div className="relative z-10 text-center py-6">
                                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                                    <span className="material-symbols-outlined text-4xl text-green-600 dark:text-green-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                </div>
                                <h3 className="text-xl font-display font-bold text-neutral-900 dark:text-white mb-2">Thanks for your feedback!</h3>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400">Your input helps us make ChewnPour better for everyone.</p>
                            </div>
                        ) : (
                            <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-2xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>rate_review</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-display font-bold text-neutral-900 dark:text-white">How's your experience?</h3>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400">We'd love to hear what you think</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-5">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFeedbackRating(star)}
                                            className="group/star p-1.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/5 transition-colors"
                                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                        >
                                            <span
                                                className={`material-symbols-outlined text-3xl transition-all ${
                                                    star <= feedbackRating
                                                        ? 'text-amber-400 scale-110'
                                                        : 'text-neutral-300 dark:text-neutral-500 group-hover/star:text-amber-300'
                                                }`}
                                                style={star <= feedbackRating ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                            >
                                                star
                                            </span>
                                        </button>
                                    ))}
                                    {feedbackRating > 0 && (
                                        <span className="ml-2 text-sm font-semibold text-primary">
                                            {['', 'Needs work', 'Could be better', 'It\'s okay', 'Really good!', 'Love it!'][feedbackRating]}
                                        </span>
                                    )}
                                </div>
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    placeholder="What can we do better? Any features you'd love to see?"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-white placeholder-neutral-400 focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-colors resize-none shadow-sm"
                                />
                                <div className="flex justify-end mt-4">
                                    <button
                                        type="button"
                                        disabled={(!feedbackText.trim() && feedbackRating === 0) || feedbackSubmitting}
                                        onClick={async () => {
                                            if (!userId) return;
                                            setFeedbackSubmitting(true);
                                            try {
                                                await submitFeedbackMutation({
                                                    userId,
                                                    rating: feedbackRating || 0,
                                                    message: feedbackText.trim() || undefined,
                                                });
                                                setFeedbackSubmitted(true);
                                            } catch {
                                                setStreakToastMessage('Failed to send feedback. Please try again.');
                                            } finally {
                                                setFeedbackSubmitting(false);
                                            }
                                        }}
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-y-0"
                                    >
                                        <span className="material-symbols-outlined text-lg">
                                            {feedbackSubmitting ? 'hourglass_empty' : 'send'}
                                        </span>
                                        {feedbackSubmitting ? 'Sending...' : 'Send Feedback'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Toast message={streakToastMessage} onClose={() => setStreakToastMessage('')} />
        </div>
    );
};

export { DashboardAnalysis };
export default DashboardAnalysis;
