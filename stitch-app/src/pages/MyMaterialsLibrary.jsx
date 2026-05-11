import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const filterTabs = [
    { label: 'All Files', value: 'all' },
    { label: 'PDFs', value: 'pdf' },
    { label: 'Notes', value: 'notes' },
    { label: 'Processing', value: 'processing' },
];

const materials = [
    {
        id: 1,
        title: 'Introduction to Cellular Biology',
        type: 'pdf',
        date: 'Oct 12, 2023',
        status: 'ready',
        lessons: 4,
        quizzes: 2,
        cards: 32,
    },
    {
        id: 2,
        title: 'Q3 Financial Analysis Notes',
        type: 'pptx',
        date: 'Just now',
        status: 'processing',
        progress: 66,
        progressText: 'Extracting key concepts...',
    },
    {
        id: 3,
        title: 'Marketing 101 Lecture Deck',
        type: 'pptx',
        date: 'Oct 10, 2023',
        status: 'ready',
        lessons: 1,
        quizzes: 0,
        cards: 15,
    },
];

const typeIcons = {
    pdf: { icon: 'picture_as_pdf', color: 'bg-error-soft text-error' },
    pptx: { icon: 'slideshow', color: 'bg-mastery-soft text-mastery' },
    notes: { icon: 'description', color: 'bg-info-soft text-info' },
    docx: { icon: 'description', color: 'bg-info-soft text-info' },
};

const MyMaterialsLibrary = () => {
    const [activeFilter, setActiveFilter] = useState('all');

    const filteredMaterials = activeFilter === 'all'
        ? materials
        : materials.filter(m => m.type === activeFilter || (activeFilter === 'processing' && m.status === 'processing'));

    return (
        <div className="md:ml-0 pt-16 min-h-screen flex flex-col gap-space-8 p-space-6 md:p-space-10 pb-24 md:pb-space-10">
            {/* Page Header & Filters */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-4">
                <div>
                    <h2 className="font-display-lg text-display-lg text-text-primary mb-2">My Materials</h2>
                    <p className="font-body-base text-body-base text-text-secondary">Manage and study your uploaded files and generated content.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-space-3 items-center">
                    <div className="flex items-center gap-2 bg-surface px-4 py-2.5 rounded-xl border border-border-default shadow-sm w-full sm:w-64 focus-within:ring-2 focus-within:ring-primary-soft transition-all">
                        <span className="material-symbols-outlined text-[18px] text-text-muted">search</span>
                        <input
                            className="bg-transparent border-none outline-none text-body-sm font-body-sm w-full placeholder:text-text-muted focus:ring-0 p-0"
                            placeholder="Search materials..."
                            type="text"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 hide-scrollbar gap-2">
                {filterTabs.map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setActiveFilter(tab.value)}
                        className={`whitespace-nowrap px-4 py-2 rounded-lg font-label-md text-label-md shadow-sm transition-all ${
                            activeFilter === tab.value
                                ? 'bg-text-primary text-on-primary'
                                : 'bg-surface border border-border-default text-text-secondary hover:bg-surface-soft'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Material Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-6">
                {filteredMaterials.map((material) => {
                    const typeConfig = typeIcons[material.type] || typeIcons.notes;
                    return (
                        <div
                            key={material.id}
                            className={`bg-surface border border-border-subtle rounded-xl p-space-5 shadow-sm flex flex-col h-full group relative overflow-hidden ${
                                material.status === 'ready'
                                    ? 'hover:shadow-md transition-shadow duration-300'
                                    : 'opacity-80 cursor-wait'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-10 h-10 rounded-lg ${typeConfig.color} flex items-center justify-center`}>
                                    <span className="material-symbols-outlined">{typeConfig.icon}</span>
                                </div>
                                {material.status === 'ready' ? (
                                    <span className="bg-success-soft text-success px-2.5 py-1 rounded-md font-label-xs text-label-xs font-semibold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                                        Ready
                                    </span>
                                ) : (
                                    <span className="bg-warning-soft text-warning px-2.5 py-1 rounded-md font-label-xs text-label-xs font-semibold flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                                        Processing
                                    </span>
                                )}
                            </div>
                            <h3 className="font-headline-sm text-headline-sm text-text-primary mb-1 line-clamp-2">{material.title}</h3>
                            <p className="font-body-sm text-body-sm text-text-muted mb-6">Uploaded {material.date}</p>
                            <div className="mt-auto">
                                {material.status === 'ready' ? (
                                    <>
                                        <div className="flex gap-4 mb-5 border-t border-border-subtle pt-4">
                                            <div className="flex flex-col">
                                                <span className="font-label-md text-label-md text-text-primary">{material.lessons}</span>
                                                <span className="font-label-xs text-label-xs text-text-muted">Lessons</span>
                                            </div>
                                            <div className="w-px h-full bg-border-subtle"></div>
                                            <div className="flex flex-col">
                                                <span className="font-label-md text-label-md text-text-primary">{material.quizzes}</span>
                                                <span className="font-label-xs text-label-xs text-text-muted">Quizzes</span>
                                            </div>
                                            <div className="w-px h-full bg-border-subtle"></div>
                                            <div className="flex flex-col">
                                                <span className="font-label-md text-label-md text-text-primary">{material.cards}</span>
                                                <span className="font-label-xs text-label-xs text-text-muted">Cards</span>
                                            </div>
                                        </div>
                                        <Link
                                            to="/dashboard/lessons"
                                            className="w-full bg-primary text-on-primary py-2.5 rounded-lg font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm flex items-center justify-center gap-2"
                                        >
                                            Continue Study
                                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                        </Link>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-full bg-surface-muted rounded-full h-1.5 mb-5 mt-4">
                                            <div className="bg-warning h-1.5 rounded-full w-2/3 animate-pulse"></div>
                                        </div>
                                        <p className="font-label-xs text-label-xs text-warning text-center mb-5">{material.progressText}</p>
                                        <button
                                            className="w-full bg-surface-soft text-text-muted border border-border-default py-2.5 rounded-lg font-label-md text-label-md cursor-not-allowed flex items-center justify-center"
                                            disabled
                                        >
                                            Study Unavailable
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Empty State (shown when no results) */}
            {filteredMaterials.length === 0 && (
                <div className="mt-space-8 bg-surface border-2 border-dashed border-border-strong rounded-2xl p-space-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-surface-soft flex items-center justify-center text-text-muted mb-6">
                        <span className="material-symbols-outlined text-[32px]">search_off</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-text-primary mb-2">No matching materials</h3>
                    <p className="font-body-base text-body-base text-text-secondary mb-8 max-w-md">
                        We couldn't find any files matching your current filters. Try adjusting your search or upload a new file to get started.
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveFilter('all')}
                            className="bg-surface border border-border-default text-text-primary px-6 py-2.5 rounded-xl font-label-md text-label-md hover:bg-surface-soft transition-colors"
                        >
                            Clear Filters
                        </button>
                        <Link
                            to="/dashboard/upload"
                            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-label-md text-label-md hover:bg-primary-hover transition-colors shadow-sm flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                            Upload New
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyMaterialsLibrary;
