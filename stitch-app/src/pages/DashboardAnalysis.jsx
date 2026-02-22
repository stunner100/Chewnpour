import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
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

let pdfWorkerInitialized = false;

const extractPdfTextFromFile = async (file) => {
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

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item) => (typeof item.str === 'string' ? item.str : ''))
            .join(' ');
        text += `${pageText}\n`;
    }

    return text.trim();
};

const isIgnorableProcessingDispatchError = (error) => {
    const message = String(error?.message || error || '').toLowerCase();
    return message.includes('connection lost while action was in flight');
};

const getConvexErrorCode = (error) => {
    const code = error?.data?.code;
    if (typeof code === 'string' && code.trim()) return code.trim();

    const message = String(error?.message || '').trim();
    if (message.includes('UPLOAD_QUOTA_EXCEEDED')) return 'UPLOAD_QUOTA_EXCEEDED';
    return '';
};

const resolveQuotaExceededMessage = (error) => {
    const dataMessage = typeof error?.data?.message === 'string' ? error.data.message.trim() : '';
    if (dataMessage) return dataMessage;
    return 'Upload limit reached. Purchase a GHS 20 top-up to continue uploading.';
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
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllCourses, setShowAllCourses] = useState(false);
    const [streakToastMessage, setStreakToastMessage] = useState('');
    const fileInputRef = useRef(null);
    const uploadInFlightRef = useRef(false);
    const lastSeenStreakRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex queries, mutations, and actions
    const courses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
    const userStats = useQuery(api.profiles.getUserStats, userId ? { userId } : 'skip');
    const performanceInsights = useQuery(api.exams.getUserPerformanceInsights, userId ? { userId } : 'skip');
    const uploadQuota = useQuery(api.subscriptions.getUploadQuotaStatus, userId ? {} : 'skip');
    const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : 'skip');
    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createUpload = useMutation(api.uploads.createUpload);
    const createCourse = useMutation(api.courses.createCourse);
    const deleteCourse = useMutation(api.courses.deleteCourse);
    const processUploadedFile = useAction(api.ai.processUploadedFile);

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

        if (uploadQuota && Number(uploadQuota.remaining) <= 0) {
            setUploadError('Upload limit reached. Purchase a GHS 20 top-up to continue uploading.');
            reportUploadValidationRejected({
                flowType: 'study_material',
                source: 'dashboard_analysis',
                reason: 'upload_quota_exhausted_preflight',
                userId,
                file,
            });
            navigate(buildUploadLimitSubscriptionPath());
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
            currentStage = 'upload_to_storage';
            reportUploadStage(uploadObservation, currentStage);
            const result = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            if (!result.ok) {
                throw new Error(`Upload storage request failed with status ${result.status}.`);
            }

            const { storageId } = await result.json();
            if (!storageId) {
                throw new Error('Upload failed to return storage information.');
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

            // Navigate to processing page immediately
            currentStage = 'navigate_processing_page';
            reportUploadStage(uploadObservation, currentStage, { courseId, uploadId });
            navigate(`/dashboard/processing/${courseId}`);

            // Step 5: Trigger AI processing in the background (don't await)
            let extractedText = '';
            if (file.type.includes('pdf')) {
                currentStage = 'extract_pdf_text_preview';
                reportUploadStage(uploadObservation, currentStage, { uploadId, courseId });
                try {
                    extractedText = await extractPdfTextFromFile(file);
                } catch (pdfError) {
                    console.error('PDF extraction failed in browser:', pdfError);
                    reportUploadWarning(
                        uploadObservation,
                        currentStage,
                        'Client-side PDF text preview extraction failed',
                        {
                            uploadId,
                            courseId,
                            errorMessage: String(pdfError?.message || pdfError),
                        }
                    );
                }
            }

            currentStage = 'dispatch_ai_processing';
            reportUploadStage(uploadObservation, currentStage, { uploadId, courseId });
            processUploadedFile({ uploadId, courseId, userId, extractedText }).catch((err) => {
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
            reportUploadFlowCompleted(uploadObservation, {
                uploadId,
                courseId,
                processingDispatched: true,
                extractedTextLength: extractedText.length,
            });
        } catch (error) {
            console.error('Upload failed:', error);
            if (getConvexErrorCode(error) === 'UPLOAD_QUOTA_EXCEEDED') {
                setUploadError(resolveQuotaExceededMessage(error));
                reportUploadValidationRejected({
                    flowType: 'study_material',
                    source: 'dashboard_analysis',
                    reason: 'upload_quota_exhausted_backend',
                    userId,
                    file,
                });
                navigate(buildUploadLimitSubscriptionPath());
                return;
            }
            reportUploadFlowFailed(uploadObservation, error, { stage: currentStage });
            setUploadError('Upload failed. Please try again.');
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

        const confirmed = window.confirm(
            `Delete "${course.title}"? This will permanently remove the course, topics, and attempts.`
        );
        if (!confirmed) return;

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
        'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', // Indigo -> Violet
        'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // Blue -> Cyan
        'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // Pink -> Rose
        'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', // Emerald -> Blue
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
            <header className="sticky top-0 z-50 w-full glass border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4 md:gap-8">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary via-purple-500 to-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-[24px]">school</span>
                        </div>
                        <span className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">ChewnPour</span>
                    </div>
                    <div className="flex-1 max-w-xl hidden md:block">
                        <div className="relative group transition-transform duration-300 focus-within:scale-[1.01]">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
                            <input
                                className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-primary/30 rounded-2xl focus:ring-4 focus:ring-primary/5 transition-colors text-sm font-medium placeholder-slate-400 shadow-sm"
                                placeholder="Search courses, topics, or questions..."
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-orange-200 dark:border-orange-800">
                            <span className="material-symbols-outlined text-orange-500 text-[18px] filled animate-pulse">local_fire_department</span>
                            <span className="text-slate-700 dark:text-slate-200 text-xs font-bold">
                                {userStats?.streakDays || 0} Day Streak
                            </span>
                        </div>
                        <Link to="/profile" className="relative group block">
                            <div className="h-10 w-10 rounded-full p-0.5 bg-gradient-to-br from-primary via-purple-500 to-primary">
                                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                                    <span className="text-primary font-bold text-sm">
                                        {user?.name?.[0]?.toUpperCase() || 'S'}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                        </Link>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 pb-20 md:px-6 md:py-12 md:pb-12">
                {/* Mobile Search Bar */}
                <div className="md:hidden w-full mb-6 relative group transition-transform duration-300 focus-within:scale-[1.01]">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
                    <input
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-primary/30 rounded-2xl focus:ring-4 focus:ring-primary/5 transition-colors text-base font-medium placeholder-slate-400 shadow-sm"
                        placeholder="Search courses or topics..."
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onKeyDown={handleSearchKeyDown}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 flex flex-col animate-slide-up">
                        <div className="relative w-full h-full overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50 to-white dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900 p-6 sm:p-8 md:p-10 shadow-soft border border-slate-200/60 dark:border-slate-800 group isolate">
                            {/* Decorative background elements */}
                            <div className="hidden md:block absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-full blur-[120px] -z-10 group-hover:opacity-70 transition-opacity duration-700"></div>
                            <div className="hidden md:block absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-blue-500/5 to-transparent rounded-full blur-[100px] -z-10"></div>

                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between h-full gap-8">
                                <div className="flex-1 space-y-5">
                                    <span className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-purple-500/10 dark:from-primary/20 dark:to-purple-500/20 px-3 py-1.5 rounded-full border border-primary/20 dark:border-primary/30">
                                        <span className="material-symbols-outlined text-sm filled text-primary">auto_awesome</span>
                                        <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Powered v2.0</span>
                                    </span>
                                    {subscription && (
                                        subscription.plan === 'premium' ? (
                                            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/15 to-orange-500/15 dark:from-amber-500/25 dark:to-orange-500/25 px-3 py-1.5 rounded-full border border-amber-400/30">
                                                <span className="text-amber-500 text-xs">✦</span>
                                                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Premium</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Free Plan</span>
                                            </span>
                                        )
                                    )}
                                    <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-display font-extrabold text-slate-900 dark:text-white leading-[1.15] tracking-tight">
                                        Turn Your Slides into <br />
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-primary bg-[length:200%_auto] animate-gradient-x">Smart Lessons & Quizzes</span>
                                    </h1>
                                    <p className="text-slate-500 dark:text-slate-400 text-base md:text-lg font-medium leading-relaxed max-w-lg">
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
                                            className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary-hover hover:to-purple-700 active:scale-95 transition-colors text-white px-6 h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-fit"
                                        >
                                            <span className="material-symbols-outlined text-[22px] filled">
                                                {uploading ? 'hourglass_empty' : 'cloud_upload'}
                                            </span>
                                            {uploading ? 'Uploading...' : 'Upload Materials'}
                                        </button>
                                        <p className="mt-3 text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px] text-green-500">verified</span>
                                            Secure • PDF, PPTX, DOCX • Max 50MB
                                        </p>
                                        {uploadQuota && (
                                            <div className="mt-4 w-full sm:w-72">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                        {uploadQuota.remaining} of {uploadQuota.totalAllowed} uploads remaining
                                                    </span>
                                                    {uploadQuota.remaining === 0 && (
                                                        <Link
                                                            to={buildUploadLimitSubscriptionPath()}
                                                            className="text-[11px] font-bold text-primary hover:text-primary-hover"
                                                        >
                                                            Get More
                                                        </Link>
                                                    )}
                                                </div>
                                                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center justify-center relative w-1/3">
                                    <div className="w-48 h-48 bg-gradient-to-br from-white to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-[2rem] flex items-center justify-center shadow-xl relative z-10 rotate-3 border border-slate-200/50 dark:border-slate-700/50">
                                        <div className="absolute inset-2 bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-[1.75rem]"></div>
                                        <span className="material-symbols-outlined text-[64px] text-primary relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                                    </div>
                                    <div className="absolute -z-10 top-4 right-4 w-48 h-48 bg-gradient-to-br from-primary/30 to-purple-500/30 rounded-[2rem] -rotate-6 blur-xl"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4 flex flex-col h-full animate-slide-up animate-delay-100 space-y-4">
                        <Link to="/dashboard/assignment-helper" className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 sm:p-6 shadow-lg shadow-blue-500/20 transition-shadow duration-300 cursor-pointer group hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-1">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-indigo-600/30 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
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
                        <Link to="/dashboard/humanizer" className="relative flex-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 p-5 sm:p-6 shadow-lg shadow-purple-500/20 transition-shadow duration-300 cursor-pointer group hover:shadow-xl hover:shadow-purple-500/30 hover:-translate-y-1">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-600/30 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
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
                    <div className="col-span-1 lg:col-span-12 mt-2 animate-slide-up animate-delay-200">
                        <div className="flex items-center justify-between mb-6 px-1">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                                    <span className="material-symbols-outlined text-xl filled">history</span>
                                </div>
                                <div>
                                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Continue Learning</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Pick up where you left off</p>
                                </div>
                            </div>
                            {canToggleAllCourses && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllCourses((current) => !current)}
                                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors"
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
                                            className="group flex flex-col bg-white dark:bg-surface-dark rounded-2xl overflow-hidden shadow-sm border border-slate-200/60 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/30 dark:hover:shadow-black/30 hover:-translate-y-1 transition-shadow duration-300 cursor-pointer h-full"
                                        >
                                            <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                <button
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        handleDeleteCourse(course);
                                                    }}
                                                    disabled={deletingCourseId === String(course._id)}
                                                    className="absolute top-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:border-red-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-60"
                                                    title="Delete course"
                                                    aria-label={`Delete ${course.title}`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {deletingCourseId === String(course._id) ? 'hourglass_empty' : 'delete'}
                                                    </span>
                                                </button>
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
                                                    <span className={`text-xs font-bold ${isExcellent ? 'text-green-600' : isGood ? 'text-blue-600' : 'text-slate-400'}`}>
                                                        {progress}%
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-xs line-clamp-2">{course.description}</p>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                                <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
                                        <span className="material-symbols-outlined text-3xl">school</span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                        {searchQuery.trim() ? 'No matching courses' : 'No courses yet'}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 max-w-xs mx-auto">
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
                                className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors duration-300 cursor-pointer min-h-[220px] group h-full disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-300 disabled:hover:bg-slate-50 disabled:hover:text-slate-500"
                            >
                                <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <span className="material-symbols-outlined text-2xl text-primary">add</span>
                                </div>
                                <span className="font-bold text-base">Add New Course</span>
                                <span className="text-xs text-slate-400 mt-1">PDF, PPTX, DOCX</span>
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
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                <span className="material-symbols-outlined text-xl filled">insights</span>
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Your Progress Snapshot</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm">Based on your exam history</p>
                            </div>
                        </div>

                        {/* Preparedness gauge */}
                        <div className="mb-6 bg-white dark:bg-surface-dark rounded-2xl border border-slate-200/60 dark:border-slate-800 p-5 flex items-center gap-5 shadow-sm">
                            <div className="relative w-16 h-16 shrink-0">
                                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                                    <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-slate-800" />
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
                                <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900 dark:text-white">
                                    {performanceInsights.overallPreparedness}%
                                </span>
                            </div>
                            <div>
                                <p className="text-base font-bold text-slate-900 dark:text-white">
                                    {performanceInsights.overallPreparedness >= 80
                                        ? 'Exam Ready'
                                        : performanceInsights.overallPreparedness >= 50
                                            ? 'Almost Ready'
                                            : 'Needs More Practice'}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
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
            </main>
            <Toast message={streakToastMessage} onClose={() => setStreakToastMessage('')} />
        </div>
    );
};

export default DashboardAnalysis;
