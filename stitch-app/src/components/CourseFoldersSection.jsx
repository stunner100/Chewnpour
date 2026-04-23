import React, { useEffect, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import CourseCard from './CourseCard';

const CourseFoldersSection = ({
    userId,
    folders,
    coursesByFolder,
    allFolders,
    deletingCourseId,
    confirmDeleteId,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onMoveToFolder,
    movingCourseId,
}) => {
    const createFolder = useMutation(api.courseFolders.createFolder);
    const renameFolder = useMutation(api.courseFolders.renameFolder);
    const deleteFolder = useMutation(api.courseFolders.deleteFolder);

    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [collapsed, setCollapsed] = useState(() => new Set());
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState(null);
    const menuRefs = useRef(new Map());

    useEffect(() => {
        if (menuOpenId === null) return;
        const handleClickOutside = (event) => {
            const node = menuRefs.current.get(menuOpenId);
            if (node && !node.contains(event.target)) {
                setMenuOpenId(null);
            }
        };
        const handleKey = (event) => {
            if (event.key === 'Escape') setMenuOpenId(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpenId]);

    const toggleCollapse = (folderId) => {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!userId) return;
        const trimmed = newName.trim();
        if (!trimmed) {
            setError('Please enter a name.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await createFolder({ userId, name: trimmed });
            setNewName('');
            setCreating(false);
        } catch (err) {
            setError(err?.message || 'Could not create folder.');
        } finally {
            setSubmitting(false);
        }
    };

    const beginRename = (folder) => {
        setMenuOpenId(null);
        setRenamingId(folder._id);
        setRenameValue(folder.name);
    };

    const submitRename = async (folder) => {
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === folder.name) {
            setRenamingId(null);
            return;
        }
        try {
            await renameFolder({ folderId: folder._id, userId, name: trimmed });
        } catch (err) {
            setError(err?.message || 'Could not rename folder.');
        } finally {
            setRenamingId(null);
        }
    };

    const confirmDeleteFolder = async (folder) => {
        try {
            await deleteFolder({ folderId: folder._id, userId });
            setConfirmDeleteFolderId(null);
        } catch (err) {
            setError(err?.message || 'Could not delete folder.');
        }
    };

    return (
        <section className="animate-fade-in-up animate-delay-250 mt-8">
            <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Folders</h2>
                {!creating && (
                    <button
                        type="button"
                        onClick={() => { setCreating(true); setError(''); }}
                        className="btn-ghost text-caption"
                    >
                        <span className="material-symbols-outlined text-[16px]">create_new_folder</span>
                        New folder
                    </button>
                )}
            </div>

            {creating && (
                <form
                    onSubmit={handleCreate}
                    className="mb-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center card-flat p-3"
                >
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Folder name"
                        maxLength={80}
                        autoFocus
                        className="flex-1 px-3 py-2 rounded-lg border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark text-body-sm text-text-main-light dark:text-text-main-dark focus:outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            disabled={submitting || !newName.trim()}
                            className="btn-primary text-body-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Creating…' : 'Create'}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setCreating(false); setNewName(''); setError(''); }}
                            className="btn-ghost text-body-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {error && (
                <div className="mb-3 text-caption text-red-600 dark:text-red-400">{error}</div>
            )}

            {folders.length === 0 && !creating && (
                <div className="py-8 text-center card-flat">
                    <div className="w-12 h-12 rounded-2xl bg-surface-hover dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-2">
                        <span className="material-symbols-outlined text-xl text-text-faint-light dark:text-text-faint-dark">folder</span>
                    </div>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
                        No folders yet. Create one to organize your courses.
                    </p>
                </div>
            )}

            <div className="space-y-4">
                {folders.map((folder) => {
                    const coursesInFolder = coursesByFolder.get(folder._id) || [];
                    const isCollapsed = collapsed.has(folder._id);
                    const isRenaming = renamingId === folder._id;
                    const isMenuOpen = menuOpenId === folder._id;
                    const isConfirmingDelete = confirmDeleteFolderId === folder._id;

                    return (
                        <div
                            key={folder._id}
                            className="card-flat p-4"
                        >
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <button
                                    type="button"
                                    onClick={() => toggleCollapse(folder._id)}
                                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                                    aria-expanded={!isCollapsed}
                                >
                                    <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">
                                        {isCollapsed ? 'chevron_right' : 'expand_more'}
                                    </span>
                                    <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                                    {isRenaming ? (
                                        <input
                                            type="text"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            onBlur={() => submitRename(folder)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); submitRename(folder); }
                                                if (e.key === 'Escape') { setRenamingId(null); }
                                            }}
                                            maxLength={80}
                                            autoFocus
                                            className="flex-1 min-w-0 px-2 py-1 rounded border border-primary bg-surface-light dark:bg-surface-dark text-body-md font-semibold text-text-main-light dark:text-text-main-dark focus:outline-none"
                                        />
                                    ) : (
                                        <span className="text-body-md font-semibold text-text-main-light dark:text-text-main-dark truncate">
                                            {folder.name}
                                        </span>
                                    )}
                                    <span className="text-caption text-text-faint-light dark:text-text-faint-dark ml-1">
                                        {coursesInFolder.length}
                                    </span>
                                </button>

                                {isConfirmingDelete ? (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-caption text-red-600 dark:text-red-400">Delete folder?</span>
                                        <button
                                            type="button"
                                            onClick={() => confirmDeleteFolder(folder)}
                                            className="text-caption font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                        >Yes</button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteFolderId(null)}
                                            className="text-caption text-text-sub-light px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors"
                                        >No</button>
                                    </div>
                                ) : (
                                    <div
                                        ref={(node) => {
                                            if (node) menuRefs.current.set(folder._id, node);
                                            else menuRefs.current.delete(folder._id);
                                        }}
                                        className="relative"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setMenuOpenId(isMenuOpen ? null : folder._id)}
                                            className="btn-icon w-7 h-7"
                                            aria-haspopup="menu"
                                            aria-expanded={isMenuOpen}
                                            aria-label={`Actions for folder ${folder.name}`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                                        </button>
                                        {isMenuOpen && (
                                            <div
                                                role="menu"
                                                className="absolute right-0 mt-1 w-40 rounded-lg border border-border-subtle dark:border-border-subtle-dark bg-surface-light dark:bg-surface-dark shadow-lg py-1 z-30"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => beginRename(folder)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-left text-text-main-light dark:text-text-main-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                    Rename
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setMenuOpenId(null); setConfirmDeleteFolderId(folder._id); }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-body-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-border-subtle dark:border-border-subtle-dark"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isCollapsed && (
                                coursesInFolder.length === 0 ? (
                                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark px-1">
                                        Empty. Move courses here using the <span className="material-symbols-outlined text-[12px] align-middle">more_horiz</span> menu on a course.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {coursesInFolder.map((course, index) => (
                                            <CourseCard
                                                key={course._id}
                                                course={course}
                                                index={index}
                                                folders={allFolders}
                                                currentFolderId={folder._id}
                                                deletingCourseId={deletingCourseId}
                                                confirmDeleteId={confirmDeleteId}
                                                movingCourseId={movingCourseId}
                                                onRequestDelete={onRequestDelete}
                                                onCancelDelete={onCancelDelete}
                                                onConfirmDelete={onConfirmDelete}
                                                onMoveToFolder={onMoveToFolder}
                                            />
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default CourseFoldersSection;
