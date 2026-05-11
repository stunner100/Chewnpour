import React from 'react';
import { Link } from 'react-router-dom';

const recentUploads = [
    {
        id: 1,
        title: 'Biology 101 - Cell Structure.pdf',
        type: 'pdf',
        date: '2 hours ago',
        size: '2.4 MB',
        status: 'ready',
    },
    {
        id: 2,
        title: 'Marketing Strategy Q3 Deck.pptx',
        type: 'pptx',
        date: 'Just now',
        size: '5.1 MB',
        status: 'processing',
        progress: 45,
        progressText: 'Extracting text...',
    },
    {
        id: 3,
        title: 'Lecture Notes - History 204.docx',
        type: 'docx',
        date: 'Yesterday',
        size: '1.1 MB',
        status: 'ready',
    },
];

const typeConfig = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-warning-soft text-warning' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
};

const UploadMaterials = () => {
    return (
        <div className="flex-1 flex flex-col md:ml-0 h-full overflow-hidden">
            <main className="flex-1 overflow-y-auto p-space-4 md:p-space-10 pb-32 md:pb-space-10 pt-16">
                <div className="max-w-[1000px] mx-auto">
                    {/* Page Header */}
                    <div className="mb-space-8">
                        <h1 className="font-display-lg text-display-lg text-text-primary mb-space-2">Add to your workspace</h1>
                        <p className="font-body-lg text-body-lg text-text-secondary">
                            Upload your course materials to generate instant study guides, flashcards, and quizzes.
                        </p>
                    </div>

                    {/* Upload Area */}
                    <div className="border-2 border-dashed border-border-strong bg-surface-soft hover:bg-surface-muted transition-colors duration-300 rounded-[24px] p-space-12 flex flex-col items-center justify-center text-center cursor-pointer group relative overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-40 h-40 bg-white opacity-40 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary-soft opacity-40 rounded-full blur-2xl"></div>
                        <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-space-6 group-hover:scale-105 transition-transform duration-300 z-10">
                            <span className="material-symbols-outlined text-[48px] text-primary">cloud_upload</span>
                        </div>
                        <h3 className="font-headline-md text-headline-md text-text-primary mb-space-2 z-10">
                            Drop your PDFs, slides, or notes here
                        </h3>
                        <p className="font-body-base text-body-base text-text-secondary mb-space-8 z-10 max-w-md">
                            Our AI will automatically process your files, extract key concepts, and prepare them for study generation.
                        </p>
                        <button className="bg-primary text-on-primary rounded-xl px-space-6 py-space-3 font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm flex items-center gap-2 z-10">
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Upload Material
                        </button>
                        <div className="mt-space-6 flex items-center gap-space-4 font-label-xs text-label-xs text-text-muted z-10 flex-wrap justify-center">
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span> PDF
                            </span>
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">slideshow</span> PPTX
                            </span>
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">description</span> DOCX
                            </span>
                            <span className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm border border-border-subtle">
                                <span className="material-symbols-outlined text-[14px]">textsms</span> TXT
                            </span>
                        </div>
                    </div>

                    {/* Recent Uploads */}
                    <div className="mt-space-16">
                        <div className="flex justify-between items-end mb-space-6">
                            <h4 className="font-headline-sm text-headline-sm text-text-primary">Recent Uploads</h4>
                            <Link className="font-label-md text-label-md text-primary hover:text-primary-hover transition-colors" to="/dashboard/library">
                                View all
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-5">
                            {recentUploads.map((upload) => {
                                const config = typeConfig[upload.type] || typeConfig.docx;
                                return (
                                    <div
                                        key={upload.id}
                                        className="bg-surface rounded-xl shadow-sm border border-border-subtle p-space-5 hover:shadow-md transition-shadow cursor-pointer group flex flex-col h-full"
                                    >
                                        <div className="flex justify-between items-start mb-space-4">
                                            <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                                                <span className="material-symbols-outlined">{config.icon}</span>
                                            </div>
                                            {upload.status === 'ready' ? (
                                                <span className="bg-success-soft text-success px-2 py-1 rounded-md font-label-xs text-label-xs flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                                    Ready
                                                </span>
                                            ) : (
                                                <span className="bg-info-soft text-info px-2 py-1 rounded-md font-label-xs text-label-xs flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                                                    Processing
                                                </span>
                                            )}
                                        </div>
                                        <h5 className="font-label-md text-label-md text-text-primary mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                                            {upload.title}
                                        </h5>
                                        <p className="font-body-sm text-body-sm text-text-secondary mb-space-4">
                                            Uploaded {upload.date} &bull; {upload.size}
                                        </p>
                                        {upload.status === 'ready' ? (
                                            <div className="mt-auto pt-space-4 border-t border-border-subtle flex gap-2">
                                                <button className="flex-1 bg-surface-soft text-text-primary rounded-lg py-2 font-label-xs text-label-xs hover:bg-surface-variant transition-colors">
                                                    Generate
                                                </button>
                                                <button className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-surface-soft hover:text-text-primary transition-colors">
                                                    <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="mt-auto pt-space-4 border-t border-border-subtle">
                                                <div className="w-full bg-surface-muted rounded-full h-1.5 mb-1">
                                                    <div className="bg-info h-1.5 rounded-full" style={{ width: `${upload.progress}%` }}></div>
                                                </div>
                                                <p className="font-label-xs text-label-xs text-text-muted text-right">{upload.progressText}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default UploadMaterials;
