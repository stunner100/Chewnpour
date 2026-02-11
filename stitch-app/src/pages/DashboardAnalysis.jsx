import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

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

const DashboardAnalysis = () => {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deletingCourseId, setDeletingCourseId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const { user } = useAuth();

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex queries, mutations, and actions
    const courses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');
    const userStats = useQuery(api.profiles.getUserStats, userId ? { userId } : 'skip');
    const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
    const createUpload = useMutation(api.uploads.createUpload);
    const createCourse = useMutation(api.courses.createCourse);
    const deleteCourse = useMutation(api.courses.deleteCourse);
    const processUploadedFile = useAction(api.ai.processUploadedFile);

    const handleFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!userId) {
            setUploadError('Please log in to upload files');
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
            return;
        }

        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
            setUploadError('File must be less than 50MB');
            return;
        }

        setUploadError('');
        setUploading(true);

        try {
            // Step 1: Get upload URL from Convex
            const uploadUrl = await generateUploadUrl();

            // Step 2: Upload file to Convex storage
            const result = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file,
            });

            const { storageId } = await result.json();

            // Step 3: Create upload record
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
            const courseId = await createCourse({
                userId,
                title: file.name.replace(/\.(pdf|pptx|docx)$/i, ''),
                description: 'Processing your study materials...',
                uploadId,
            });

            // Navigate to processing page immediately
            navigate(`/dashboard/processing/${courseId}`);

            // Step 5: Trigger AI processing in the background (don't await)
            let extractedText = '';
            if (file.type.includes('pdf')) {
                try {
                    extractedText = await extractPdfTextFromFile(file);
                } catch (pdfError) {
                    console.error('PDF extraction failed in browser:', pdfError);
                }
            }

            processUploadedFile({ uploadId, courseId, userId, extractedText }).catch(err => {
                console.error('AI processing failed:', err);
            });
        } catch (error) {

            console.error('Upload failed:', error);
            setUploadError('Upload failed. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleUploadClick = () => {
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

    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filteredCourses = React.useMemo(() => {
        if (!courses || !normalizedSearch) return courses || [];
        return courses.filter((course) => {
            const title = course.title?.toLowerCase() || '';
            const description = course.description?.toLowerCase() || '';
            return title.includes(normalizedSearch) || description.includes(normalizedSearch);
        });
    }, [courses, normalizedSearch]);
    const visibleCourses = normalizedSearch ? filteredCourses : (courses || []);
    const displayCourses = normalizedSearch ? visibleCourses : visibleCourses.slice(0, 3);

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col transition-colors duration-300">
            <header className="sticky top-0 z-50 w-full glass border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4 md:gap-8">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-[24px]">school</span>
                        </div>
                        <span className="text-xl font-display font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">StudyMate</span>
                    </div>
                    <div className="flex-1 max-w-2xl hidden md:block">
                        <div className="relative group transition-all duration-300 focus-within:scale-[1.01]">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
                            <input
                                className="w-full pl-12 pr-4 py-3 bg-slate-100/50 dark:bg-slate-800/50 border border-transparent focus:border-primary/20 rounded-2xl focus:ring-4 focus:ring-primary/10 focus:bg-white dark:focus:bg-slate-800 transition-all text-sm font-medium placeholder-slate-400 shadow-sm"
                                placeholder="Search for courses, slides, or questions..."
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:border-primary/30 transition-colors cursor-default">
                            <span className="material-symbols-outlined text-orange-500 text-[22px] filled icon-filled animate-pulse-subtle">local_fire_department</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-slate-700 dark:text-slate-200 text-sm font-bold">
                                    {userStats?.streakDays || 0} Day Streak
                                </span>
                            </div>
                        </div>
                        <Link to="/profile" className="relative group block">
                            <div className="h-11 w-11 rounded-full border-2 border-white dark:border-slate-700 shadow-md overflow-hidden transition-transform group-hover:scale-105 ring-2 ring-transparent group-hover:ring-primary/20">
                                <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary flex items-center justify-center text-white font-bold text-lg">
                                    {user?.name?.[0]?.toUpperCase() || 'S'}
                                </div>
                            </div>
                            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full shadow-sm"></div>
                        </Link>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 pb-20 md:px-6 md:py-12 md:pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 flex flex-col animate-slide-up">
                        <div className="relative w-full h-full overflow-hidden rounded-2xl md:rounded-[2rem] bg-surface-light dark:bg-surface-dark p-5 sm:p-8 md:p-12 shadow-soft border border-slate-200/60 dark:border-slate-800 group isolate">
                            {/* Decorative background elements */}
                            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 group-hover:bg-primary/10 transition-colors duration-700"></div>
                            <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[80px] -z-10"></div>

                            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between h-full gap-8">
                                <div className="flex-1 space-y-6">
                                    <span className="inline-flex items-center gap-2 bg-primary/10 dark:bg-primary/20 px-4 py-1.5 rounded-full border border-primary/20 dark:border-primary/30 text-primary-dark dark:text-primary-light">
                                        <span className="material-symbols-outlined text-sm filled">auto_awesome</span>
                                        <span className="text-xs font-bold uppercase tracking-wider">AI Powered v2.0</span>
                                    </span>
                                    <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-display font-extrabold text-slate-900 dark:text-white leading-[1.1] tracking-tight">
                                        Turn Your Boring Slides into <br />
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600 animate-gradient">Clear Lessons and Interactive Quizzes</span>
                                    </h1>
                                    <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed max-w-xl">
                                        Upload any PDF, PPTX, or DOCX. Our AI extracts key concepts and generates clear, detailed lessons.
                                    </p>
                                    <div className="pt-2">
                                        {uploadError && (
                                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium">
                                                {uploadError}
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.pptx,.docx"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                        <button
                                            onClick={handleUploadClick}
                                            disabled={uploading}
                                            className="flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover active:bg-primary-dark transition-all hover:-translate-y-0.5 text-white px-6 md:px-8 h-12 md:h-14 rounded-2xl text-base md:text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none w-full sm:w-fit"
                                        >
                                            <span className="material-symbols-outlined text-[26px] filled">
                                                {uploading ? 'hourglass_empty' : 'add_circle'}
                                            </span>
                                            {uploading ? 'Uploading...' : 'Upload Materials'}
                                        </button>
                                        <p className="mt-4 text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[16px]">verified_user</span>
                                            Securely processed. Supports PDF, PPTX (Max 50MB)
                                        </p>
                                    </div>
                                </div>
                                <div className="hidden md:flex items-center justify-center relative w-1/3">
                                    <div className="w-56 h-56 bg-gradient-to-tr from-surface-light to-slate-100 dark:from-surface-dark dark:to-slate-800 rounded-[2.5rem] flex items-center justify-center shadow-inner relative z-10 rotate-3 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105 border border-white/50 dark:border-white/5">
                                        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent rounded-[2.5rem]"></div>
                                        <span className="material-symbols-outlined text-[80px] text-primary drop-shadow-xl" style={{ fontVariationSettings: "'wght' 600" }}>cloud_upload</span>
                                    </div>
                                    <div className="absolute -z-10 top-6 right-6 w-56 h-56 bg-primary/20 rounded-[2.5rem] -rotate-6 blur-sm"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-4 flex flex-col h-full animate-slide-up animate-delay-100">
                        <Link to="/dashboard/assignment-helper" className="relative h-full flex flex-col justify-between overflow-hidden rounded-2xl md:rounded-[2rem] bg-surface-light dark:bg-surface-dark border-2 border-transparent hover:border-primary/20 p-5 sm:p-8 shadow-soft transition-all duration-300 cursor-pointer group hover:shadow-xl hover:-translate-y-1">
                            <div className="absolute right-[-40px] top-[-40px] h-64 w-64 rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl pointer-events-none transition-opacity group-hover:opacity-100 opacity-50"></div>
                            <div className="relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-sm">
                                    <span className="material-symbols-outlined text-[32px] filled">assignment</span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-3">
                                    Assignment <br />
                                    <span className="text-primary">Helper</span>
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-6">
                                    Upload your assignment sheet or a photo and get direct answers with follow-up chat.
                                </p>
                            </div>
                            <div className="relative z-10 mt-auto">
                                <div className="w-full h-14 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-800 hover:border-primary/30 hover:text-primary transition-all text-slate-700 dark:text-slate-200 rounded-2xl text-base font-bold flex items-center justify-between px-6 group-hover:shadow-lg">
                                    <span>Open Assignment Helper</span>
                                    <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                    <div className="col-span-1 lg:col-span-12 mt-4 animate-slide-up animate-delay-200">
                        <div className="flex items-center justify-between mb-8 px-2">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-1 bg-primary rounded-full"></div>
                                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Jump back in</h2>
                            </div>
                            <a className="text-slate-500 hover:text-primary font-bold text-sm transition-colors flex items-center gap-1 group" href="#">
                                View all history
                                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                            </a>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {displayCourses.length > 0 ? (
                                displayCourses.map((course, index) => (
                                    <Link
                                        key={course._id}
                                        to={`/dashboard/course/${course._id}`}
                                        className="group flex flex-col bg-surface-light dark:bg-surface-dark rounded-[1.5rem] p-3 shadow-sm border border-slate-200/50 dark:border-slate-800 hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full"
                                    >
                                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 mb-4 shadow-inner">
                                            <button
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    handleDeleteCourse(course);
                                                }}
                                                disabled={deletingCourseId === String(course._id)}
                                                className="absolute top-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 hover:border-red-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                                                title="Delete course"
                                                aria-label={`Delete ${course.title}`}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">
                                                    {deletingCourseId === String(course._id) ? 'hourglass_empty' : 'delete'}
                                                </span>
                                            </button>
                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700 z-10">
                                                <div
                                                    className="h-full bg-green-500 rounded-r-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                                    style={{ width: `${course.progress || 0}%` }}
                                                ></div>
                                            </div>
                                            <div
                                                className="w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-110"
                                                style={{ background: course.coverColor || gradients[index % gradients.length] }}
                                            >
                                                <span className="material-symbols-outlined text-white text-5xl drop-shadow-lg">menu_book</span>
                                            </div>
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px]">
                                                <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transform scale-90 group-hover:scale-100 transition-transform">
                                                    <span className="material-symbols-outlined text-primary text-[32px] ml-1 filled">play_arrow</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col px-2 pb-3 pt-1 gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${course.status === 'completed'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                                                    }`}>
                                                    {course.status === 'completed' ? 'Completed' : 'In Progress'}
                                                </span>
                                                <span className="text-slate-400 text-xs font-bold">{course.progress || 0}%</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-1 line-clamp-1 group-hover:text-primary transition-colors">{course.title}</h3>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">{course.description}</p>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="col-span-full py-16 text-center rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-600">
                                        <span className="material-symbols-outlined text-4xl">school</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                        {normalizedSearch ? 'No matching courses' : 'No courses yet'}
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto">
                                        {normalizedSearch
                                            ? 'Try a different keyword or clear your search.'
                                            : 'Upload your first study material above to get started!'}
                                    </p>
                                    {!normalizedSearch && (
                                        <button onClick={handleUploadClick} className="text-primary font-bold hover:underline">Upload Now</button>
                                    )}
                                </div>
                            )}
                            <div
                                onClick={handleUploadClick}
                                className="flex flex-col items-center justify-center bg-transparent rounded-[1.5rem] border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all duration-300 cursor-pointer min-h-[260px] group h-full"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 group-hover:rotate-90 transition-all duration-500 group-hover:bg-primary group-hover:text-white">
                                    <span className="material-symbols-outlined text-[32px]">add</span>
                                </div>
                                <span className="font-bold text-lg">Add New Course</span>
                                <span className="text-xs font-medium opacity-60 mt-1">PDF, PPTX or Word</span>
                            </div>
                        </div>
                        {deleteError && (
                            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                                {deleteError}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DashboardAnalysis;
