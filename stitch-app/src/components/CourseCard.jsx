import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const gradients = [
    '#7c3aed',
    '#f43f5e',
    '#06b6d4',
    '#10b981',
];

const CourseCard = ({
    course,
    index = 0,
    folders = [],
    currentFolderId = null,
    deletingCourseId,
    confirmDeleteId,
    movingCourseId,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onMoveToFolder,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [moveSubmenuOpen, setMoveSubmenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false);
                setMoveSubmenuOpen(false);
            }
        };
        const handleKey = (event) => {
            if (event.key === 'Escape') {
                setMenuOpen(false);
                setMoveSubmenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpen]);

    const isCompleted = course.status === 'completed';
    const progress = course.progress || 0;
    const isExcellent = progress >= 80;
    const isGood = progress >= 50;
    const isDeleting = deletingCourseId === String(course._id);
    const isMoving = movingCourseId === String(course._id);
    const isConfirmingDelete = confirmDeleteId === course._id;

    const stopCardNav = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const closeMenu = () => {
        setMenuOpen(false);
        setMoveSubmenuOpen(false);
    };

    const handleMove = async (folderId) => {
        closeMenu();
        if (onMoveToFolder) await onMoveToFolder(course, folderId);
    };

    return (
        <Link
            to={`/dashboard/course/${course._id}`}
            className="group card-interactive flex flex-col overflow-hidden relative"
        >
            <div className="relative w-full aspect-[16/9] overflow-hidden">
                {isConfirmingDelete ? (
                    <div
                        onClick={stopCardNav}
                        className="absolute top-2 right-2 z-20 flex items-center gap-1.5 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-lg px-2.5 py-1.5 shadow-card"
                    >
                        <span className="text-caption text-red-600 dark:text-red-400">Delete?</span>
                        <button
                            onClick={(e) => { stopCardNav(e); onConfirmDelete && onConfirmDelete(course); }}
                            disabled={isDeleting}
                            className="text-caption font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60"
                        >Yes</button>
                        <button
                            onClick={(e) => { stopCardNav(e); onCancelDelete && onCancelDelete(); }}
                            className="text-caption text-text-sub-light px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors"
                        >No</button>
                    </div>
                ) : (
                    <div
                        ref={menuRef}
                        onClick={stopCardNav}
                        className="absolute top-2 right-2 z-20"
                    >
                        <button
                            type="button"
                            onClick={(e) => { stopCardNav(e); setMenuOpen((v) => !v); setMoveSubmenuOpen(false); }}
                            disabled={isDeleting || isMoving}
                            className="btn-icon w-7 h-7 bg-surface-light/90 dark:bg-surface-dark/90 border border-border-subtle dark:border-border-subtle-dark opacity-0 group-hover:opacity-100 focus:opacity-100 data-[open=true]:opacity-100 transition-all"
                            data-open={menuOpen}
                            title="Course actions"
                            aria-label={`Actions for ${course.title}`}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                        >
                            <span className="material-symbols-outlined text-[16px]">
                                {isDeleting || isMoving ? 'hourglass_empty' : 'more_horiz'}
                            </span>
                        </button>
                        {menuOpen && (
                            <div
                                role="menu"
                                className="absolute right-0 mt-1 w-48 rounded-lg border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-lg py-1 z-30"
                            >
                                <button
                                    type="button"
                                    onClick={(e) => { stopCardNav(e); setMoveSubmenuOpen((v) => !v); }}
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-body-sm text-left text-text-main-light dark:text-text-main-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark"
                                    aria-haspopup="menu"
                                    aria-expanded={moveSubmenuOpen}
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                                        Move to folder
                                    </span>
                                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                </button>
                                {moveSubmenuOpen && (
                                    <div className="max-h-56 overflow-y-auto border-t border-border-subtle dark:border-border-subtle-dark mt-1 pt-1">
                                        {folders.length === 0 && (
                                            <div className="px-3 py-2 text-caption text-text-faint-light dark:text-text-faint-dark">
                                                No folders yet. Create one below your courses.
                                            </div>
                                        )}
                                        {folders.map((folder) => {
                                            const isCurrent = currentFolderId === folder._id;
                                            return (
                                                <button
                                                    key={folder._id}
                                                    type="button"
                                                    disabled={isCurrent}
                                                    onClick={(e) => { stopCardNav(e); handleMove(folder._id); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-left text-text-main-light dark:text-text-main-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">folder</span>
                                                    <span className="truncate">{folder.name}</span>
                                                    {isCurrent && (
                                                        <span className="material-symbols-outlined text-[14px] ml-auto text-accent-emerald">check</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                        {currentFolderId && (
                                            <button
                                                type="button"
                                                onClick={(e) => { stopCardNav(e); handleMove(null); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-left text-text-sub-light dark:text-text-sub-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark border-t border-border-subtle dark:border-border-subtle-dark mt-1"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">folder_off</span>
                                                Remove from folder
                                            </button>
                                        )}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { stopCardNav(e); closeMenu(); onRequestDelete && onRequestDelete(course); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-border-subtle dark:border-border-subtle-dark"
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                    Delete course
                                </button>
                            </div>
                        )}
                    </div>
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
};

export default CourseCard;
