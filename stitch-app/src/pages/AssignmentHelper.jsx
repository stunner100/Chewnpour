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

const statusLabelMap = {
    processing: 'Processing',
    ready: 'Ready',
    error: 'Error',
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
    const [renamingThreadId, setRenamingThreadId] = useState('');
    const [deletingThreadId, setDeletingThreadId] = useState('');
    const [processingStageIndex, setProcessingStageIndex] = useState(0);
    const [activeUploadName, setActiveUploadName] = useState('');
    const uploadInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const endRef = useRef(null);

    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createThreadFromUpload = useMutation(api.assignments.createThreadFromUpload);
    const renameThread = useMutation(api.assignments.renameThread);
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
        setActiveUploadName(file.name || '');
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
            setActiveUploadName('');
        }
    };

    const handleFileInputChange = async (event) => {
        const file = event.target.files?.[0];
        await uploadAndProcessFile(file);
        event.target.value = '';
    };

    const handleRenameThread = async (thread) => {
        if (!userId || !thread?._id) return;

        const nextTitle = window.prompt('Rename thread', thread.title || '');
        if (nextTitle === null) return;

        const trimmed = nextTitle.trim();
        if (!trimmed) {
            setError('Thread title cannot be empty.');
            return;
        }

        setRenamingThreadId(String(thread._id));
        setError('');
        try {
            await renameThread({
                userId,
                threadId: thread._id,
                title: trimmed,
            });
            setSuccessMessage('Thread renamed.');
        } catch (renameError) {
            setError(renameError?.message || 'Could not rename this thread.');
        } finally {
            setRenamingThreadId('');
        }
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
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-auto md:h-20 py-3 md:py-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-6">
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </Link>
                        <div>
                            <h1 className="text-lg md:text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Assignment Helper</h1>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 hidden sm:block">Upload a question sheet or photo, then chat for follow-ups.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleCameraClick}
                            disabled={busy}
                            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-60"
                        >
                            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                            <span className="hidden sm:inline">Take Picture</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleUploadClick}
                            disabled={busy}
                            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-60"
                        >
                            <span className="material-symbols-outlined text-[20px]">{busy ? 'hourglass_empty' : 'upload_file'}</span>
                            <span className="hidden sm:inline">{busy ? 'Processing...' : 'Upload Assignment'}</span>
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

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[72vh]">
                    <aside className="lg:col-span-4 xl:col-span-3 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark shadow-soft p-4 md:p-5 max-h-[40vh] lg:max-h-none overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Threads</h2>
                            <span className="text-xs font-semibold text-slate-400">{sortedThreads.length}</span>
                        </div>
                        <div className="space-y-3 max-h-[64vh] overflow-y-auto pr-1">
                            {sortedThreads.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center">
                                    <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600">forum</span>
                                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">No threads yet</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload an assignment to start.</p>
                                </div>
                            ) : (
                                sortedThreads.map((thread) => {
                                    const isActive = String(selectedThreadId) === String(thread._id);
                                    return (
                                        <div
                                            key={thread._id}
                                            className={`rounded-2xl border transition-all ${isActive
                                                ? 'border-primary/40 bg-primary/5'
                                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 hover:border-primary/20'
                                                }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setSelectedThreadId(thread._id)}
                                                className="w-full text-left px-4 pt-3 pb-2"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{thread.title}</h3>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{thread.fileName}</p>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${thread.status === 'ready'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                        : thread.status === 'error'
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                                        }`}>
                                                        {statusLabelMap[thread.status] || thread.status}
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                                                    Updated {formatRelativeTime(thread.updatedAt)}
                                                </div>
                                            </button>
                                            <div className="flex items-center justify-end gap-2 px-3 pb-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRenameThread(thread)}
                                                    disabled={renamingThreadId === String(thread._id) || deletingThreadId === String(thread._id)}
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                                                    title="Rename thread"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {renamingThreadId === String(thread._id) ? 'hourglass_empty' : 'edit'}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteThread(thread)}
                                                    disabled={deletingThreadId === String(thread._id) || renamingThreadId === String(thread._id)}
                                                    className="h-8 w-8 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                                    title="Delete thread"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {deletingThreadId === String(thread._id) ? 'hourglass_empty' : 'delete'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    <section className="lg:col-span-8 xl:col-span-9 rounded-3xl border border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark shadow-soft flex flex-col min-h-[72vh]">
                        {!selectedThread ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
                                <div className="w-20 h-20 rounded-2xl bg-primary/10 text-primary inline-flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-4xl">assignment</span>
                                </div>
                                <h2 className="text-2xl font-display font-extrabold text-slate-900 dark:text-white">Start with an Assignment</h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
                                    Upload a PDF, DOCX, or assignment photo to get direct answers and continue with follow-up questions.
                                </p>
                                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleUploadClick}
                                        disabled={busy}
                                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">{busy ? 'hourglass_empty' : 'upload_file'}</span>
                                        Upload Assignment
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCameraClick}
                                        disabled={busy}
                                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-60"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                                        Take Picture
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg md:text-xl font-display font-bold text-slate-900 dark:text-white">{selectedThread.title}</h2>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">{selectedThread.fileName}</p>
                                        </div>
                                        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${threadStatus === 'ready'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                            : threadStatus === 'error'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                            }`}>
                                            {statusLabelMap[threadStatus] || threadStatus}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                                    {isThreadProcessing && (
                                        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-violet-50 to-sky-50 dark:from-primary/15 dark:via-slate-900 dark:to-slate-900 px-4 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="relative mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 text-primary shadow-sm">
                                                    <span className="absolute inset-0 rounded-xl border border-primary/20 animate-ping"></span>
                                                    <span className="material-symbols-outlined relative text-[20px]">auto_awesome</span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Working on your assignment</p>
                                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                                                        {currentProcessingStage.title}: {currentProcessingStage.detail}
                                                    </p>
                                                    {activeUploadName && (
                                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                            File: {activeUploadName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2">
                                                {PROCESSING_STAGES.map((stage, index) => {
                                                    const isDone = index < processingStageIndex;
                                                    const isActive = index === processingStageIndex;
                                                    return (
                                                        <div key={stage.title} className="flex items-center gap-2">
                                                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${isDone
                                                                ? 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                : isActive
                                                                    ? 'border-primary/40 bg-primary/15 text-primary'
                                                                    : 'border-slate-300 bg-white/80 text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
                                                                }`}>
                                                                {isDone ? '✓' : index + 1}
                                                            </span>
                                                            <span className={`text-xs font-semibold ${isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                                                {stage.title}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {messages.length === 0 && threadStatus === 'error' && (
                                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                            {selectedThread.errorMessage || 'Could not process this assignment. Upload a clearer file and try again.'}
                                        </div>
                                    )}
                                    {messages.map((message) => {
                                        const isAssistant = message.role === 'assistant';
                                        const displayContent = isAssistant
                                            ? (normalizeAssistantDisplayText(message.content) || message.content)
                                            : message.content;
                                        return (
                                            <div
                                                key={message._id}
                                                className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}
                                            >
                                                <div className={`max-w-[90%] md:max-w-[78%] rounded-2xl px-4 py-3 border whitespace-pre-wrap text-sm leading-relaxed ${isAssistant
                                                    ? 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                                                    : 'bg-primary text-white border-primary/40'
                                                    }`}>
                                                    {displayContent}
                                                    {isAssistant && displayContent && (
                                                        <button
                                                            type="button"
                                                            onClick={() => navigate('/dashboard/humanizer', { state: { text: displayContent } })}
                                                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
                                                            Humanize this
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {sending && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[90%] md:max-w-[78%] rounded-2xl px-4 py-3 border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                        StudyMate is typing
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {[0, 1, 2].map((dot) => (
                                                            <span
                                                                key={dot}
                                                                className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                                                                style={{ animationDelay: `${dot * 180}ms` }}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={endRef} />
                                </div>

                                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800">
                                    {threadStatus === 'processing' ? (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                            <p className="text-sm font-semibold text-amber-800">
                                                {currentProcessingStage.title}: {currentProcessingStage.detail}
                                            </p>
                                            <p className="text-xs text-amber-700 mt-1">
                                                Follow-up chat will unlock as soon as the first full answer is ready.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <textarea
                                                rows={3}
                                                value={followUpQuestion}
                                                onChange={(event) => setFollowUpQuestion(event.target.value)}
                                                onKeyDown={onComposerKeyDown}
                                                placeholder="Ask a follow-up question about this assignment..."
                                                disabled={!canAskFollowUp}
                                                className="w-full resize-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 disabled:opacity-60"
                                            />
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                                    Press Enter to send, Shift+Enter for a new line.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={handleSendFollowUp}
                                                    disabled={!canAskFollowUp || !followUpQuestion.trim()}
                                                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">{sending ? 'hourglass_empty' : 'send'}</span>
                                                    {sending ? 'Thinking...' : 'Send'}
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
        </div>
    );
};

export default AssignmentHelper;
