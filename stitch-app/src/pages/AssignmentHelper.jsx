import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
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



const PROCESSING_STAGES = [
    {
        title: 'Calculating',
        detail: 'Reading your assignment and identifying each question.',
    },
    {
        title: 'Solving',
        detail: 'Working through each part step by step.',
    },
    {
        title: 'Finalizing',
        detail: 'Getting you the best answers to review.',
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

const AssignmentHelper = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const navigate = useNavigate();

    const threads = useQuery(
        api.assignments.listThreads,
        userId ? { userId } : 'skip'
    );
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [followUpQuestion, setFollowUpQuestion] = useState('');
    const [busy, setBusy] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [deletingThreadId, setDeletingThreadId] = useState('');
    const [processingStageIndex, setProcessingStageIndex] = useState(0);
    const uploadInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const endRef = useRef(null);

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

    const sortedThreads = useMemo(() => threads || [], [threads]);

    useEffect(() => {
        if (!sortedThreads.length) {
            setSelectedThreadId(null);
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
            currentStage = 'upload_to_storage';
            reportUploadStage(uploadObservation, currentStage);
            const uploadResult = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            if (!uploadResult.ok) {
                throw new Error('Failed to upload assignment file.');
            }

            const payload = await uploadResult.json();
            const storageId = payload?.storageId;
            if (!storageId) {
                throw new Error('Upload failed to return file storage information.');
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
            console.error('Assignment upload failed:', uploadError);
            reportUploadFlowFailed(uploadObservation, uploadError, { stage: currentStage });
            setError(uploadError?.message || 'Could not process assignment. Please try again.');
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

        const confirmed = window.confirm(`Delete "${thread.title}" and all its messages?`);
        if (!confirmed) return;

        setDeletingThreadId(String(thread._id));
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
            setError(deleteError?.message || 'Could not delete this thread right now.');
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
            await askAssignmentFollowUp({
                threadId: selectedThreadId,
                userId,
                question,
            });
            setFollowUpQuestion('');
        } catch (followUpError) {
            setError(followUpError?.message || 'Could not send follow-up question.');
        } finally {
            setSending(false);
        }
    };

    const onComposerKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendFollowUp();
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col">
            <header className="sticky top-0 z-50 w-full glass border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 md:h-18 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard" className="flex size-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-slate-200 transition-colors">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined text-[18px] filled">assignment</span>
                            </div>
                            <h1 className="text-base md:text-lg font-display font-bold text-slate-900 dark:text-white">Assignment Helper</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleCameraClick}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-60"
                        >
                            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                            <span className="hidden sm:inline">Camera</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-60"
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

            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6 md:px-6 md:py-8">
                {(error || successMessage) && (
                    <div className="mb-5 space-y-2">
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                                {successMessage}
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[72vh]">
                    <aside className="lg:col-span-4 xl:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col max-h-[35vh] lg:max-h-none overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-lg">forum</span>
                                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Conversations</h2>
                            </div>
                            <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full">{sortedThreads.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {sortedThreads.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-center mb-3">
                                        <span className="material-symbols-outlined text-2xl text-blue-400">chat_add_on</span>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No assignments yet</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Upload your first assignment to get started</p>
                                </div>
                            ) : (
                                sortedThreads.map((thread) => {
                                    const isActive = String(selectedThreadId) === String(thread._id);
                                    const isDeleting = deletingThreadId === String(thread._id);
                                    return (
                                        <div
                                            key={thread._id}
                                            className={`group rounded-xl p-3 transition-all relative ${isActive
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 shadow-sm'
                                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                                                } ${isDeleting ? 'opacity-50' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => !isDeleting && setSelectedThreadId(thread._id)}
                                                disabled={isDeleting}
                                                className="w-full text-left"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isActive ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                                        <span className="material-symbols-outlined text-xl">description</span>
                                                    </div>
                                                    <div className="flex-1 min-w-0 pr-6">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className={`text-sm font-semibold truncate ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                                                                {thread.title}
                                                            </h3>
                                                        </div>
                                                        <p className="text-xs text-slate-500 truncate mt-0.5">{thread.fileName}</p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${thread.status === 'ready'
                                                                ? 'bg-green-100 text-green-700'
                                                                : thread.status === 'error'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {thread.status === 'ready' ? 'Ready' : thread.status === 'error' ? 'Failed' : 'Processing'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400">{formatRelativeTime(thread.updatedAt)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteThread(thread);
                                                }}
                                                disabled={isDeleting}
                                                className="absolute right-2 top-2 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete conversation"
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {isDeleting ? 'hourglass_empty' : 'close'}
                                                </span>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <section className="lg:col-span-8 xl:col-span-9 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col min-h-[72vh] overflow-hidden">
                        {!selectedThread ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-3xl blur-2xl opacity-20"></div>
                                    <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-blue-500/30">
                                        <span className="material-symbols-outlined text-4xl">assignment</span>
                                    </div>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Start with an Assignment</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mb-8">
                                    Upload a PDF, DOCX, or photo. Our AI will solve it and you can ask follow-up questions.
                                </p>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto max-w-xs sm:max-w-none">
                                    <button
                                        type="button"
                                        onClick={handleUploadClick}
                                        disabled={busy}
                                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-60 disabled:transform-none"
                                    >
                                        <span className="material-symbols-outlined text-lg">{busy ? 'hourglass_empty' : 'upload_file'}</span>
                                        Upload File
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCameraClick}
                                        disabled={busy}
                                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-all disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-lg">photo_camera</span>
                                        Take Photo
                                    </button>
                                </div>
                                <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        PDF
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        DOCX
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        Images
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/20">
                                            <span className="material-symbols-outlined text-lg">description</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedThread.title}</h2>
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-slate-500 truncate">{selectedThread.fileName}</p>
                                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${threadStatus === 'ready'
                                                    ? 'bg-green-100 text-green-700'
                                                    : threadStatus === 'error'
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {threadStatus === 'ready' ? 'Ready' : threadStatus === 'error' ? 'Failed' : 'Processing'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/30">
                                    {isThreadProcessing && (
                                        <div className="rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/30 p-4 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 shrink-0">
                                                    <span className="material-symbols-outlined text-lg animate-pulse">auto_awesome</span>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI is solving your assignment</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">
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
                                                                ? 'bg-green-100 text-green-600'
                                                                : isActive
                                                                    ? 'bg-blue-500 text-white animate-pulse'
                                                                    : 'bg-slate-100 text-slate-400'
                                                                }`}>
                                                                {isDone ? '✓' : index + 1}
                                                            </div>
                                                            {index < PROCESSING_STAGES.length - 1 && (
                                                                <div className={`w-6 h-0.5 ${isDone ? 'bg-green-200' : 'bg-slate-100'}`}></div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {messages.length === 0 && threadStatus === 'error' && (
                                        <div className="rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 px-4 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-red-500 text-xl">error</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">Processing Failed</p>
                                                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                                                        {selectedThread.errorMessage || 'Could not process this assignment. Try uploading a clearer file or taking a better photo.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {messages.length === 0 && threadStatus === 'processing' && (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                                <span className="material-symbols-outlined text-3xl text-slate-400 animate-pulse">hourglass_empty</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Assignment is being processed</p>
                                            <p className="text-xs text-slate-400 mt-1">Answers will appear here soon</p>
                                        </div>
                                    )}
                                    {messages.map((message, index) => {
                                        const isAssistant = message.role === 'assistant';
                                        const displayContent = isAssistant
                                            ? (normalizeAssistantDisplayText(message.content) || message.content)
                                            : message.content;
                                        const showAvatar = index === 0 || messages[index - 1].role !== message.role;
                                        return (
                                            <div
                                                key={message._id}
                                                className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} gap-2`}
                                            >
                                                {isAssistant && showAvatar && (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0 mt-1">
                                                        <span className="material-symbols-outlined text-sm">smart_toy</span>
                                                    </div>
                                                )}
                                                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 whitespace-pre-wrap text-sm leading-relaxed shadow-sm ${isAssistant
                                                    ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                                                    : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-tr-sm'
                                                    }`}>
                                                    <div className="prose prose-sm max-w-none dark:prose-invert">
                                                        {displayContent.split('\n').map((paragraph, i) => (
                                                            <p key={i} className={i > 0 ? 'mt-2' : ''}>
                                                                {paragraph}
                                                            </p>
                                                        ))}
                                                    </div>
                                                    {isAssistant && displayContent && (
                                                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate('/dashboard/humanizer', { state: { text: displayContent } })}
                                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                                                                Humanize
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigator.clipboard.writeText(displayContent)}
                                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                                                Copy
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sending && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[92%] md:max-w-[80%] rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-white text-xs">smart_toy</span>
                                                    </div>
                                                    <span className="text-xs text-slate-500">
                                                        AI is thinking
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {[0, 1, 2].map((dot) => (
                                                            <span
                                                                key={dot}
                                                                className="h-1 w-1 rounded-full bg-blue-400 animate-bounce"
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

                                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                                    {threadStatus === 'processing' ? (
                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-3 flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-lg animate-spin">refresh</span>
                                            <p className="text-xs text-slate-500">
                                                Processing assignment... Chat will be available soon
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex items-end gap-2">
                                            <div className="flex-1">
                                                <textarea
                                                    ref={(el) => {
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
                                                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 pr-12 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 disabled:opacity-50 disabled:bg-slate-100 min-h-[44px] max-h-[120px] overflow-y-auto"
                                                    rows={1}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleSendFollowUp}
                                                disabled={!canAskFollowUp || !followUpQuestion.trim() || sending}
                                                className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-xl">{sending ? 'hourglass_empty' : 'send'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AssignmentHelper;
