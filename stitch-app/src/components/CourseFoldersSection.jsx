import React, { useEffect, useReducer, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import CourseCard from './CourseCard';
import { WatermelonDisclosure } from './watermelon/WatermelonDisclosure';

const createInitialFolderUiState = () => ({
    collapsed: new Set(),
    confirmDeleteFolderId: null,
    creating: false,
    error: '',
    menuOpenId: null,
    newName: '',
    renameValue: '',
    renamingId: null,
    submitting: false,
});

const folderUiReducer = (state, action) => {
    switch (action.type) {
        case 'beginCreate':
            return { ...state, creating: true, error: '' };
        case 'beginRename':
            return {
                ...state,
                menuOpenId: null,
                renameValue: action.folder.name,
                renamingId: action.folder._id,
            };
        case 'cancelCreate':
            return { ...state, creating: false, error: '', newName: '' };
        case 'finishCreate':
            return { ...state, creating: false, newName: '', submitting: false };
        case 'finishRename':
            return { ...state, renamingId: null };
        case 'patch':
            return { ...state, ...action.patch };
        case 'toggleCollapse': {
            const collapsed = new Set(state.collapsed);
            if (collapsed.has(action.folderId)) collapsed.delete(action.folderId);
            else collapsed.add(action.folderId);
            return { ...state, collapsed };
        }
        default:
            return state;
    }
};

const focusMountedInput = (node) => {
    if (!node) return;
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => node.focus());
};

const EmptyFoldersState = () => (
    <div className="py-8 text-center card-flat">
        <div className="size-12 rounded-2xl bg-surface-hover dark:bg-surface-hover-dark flex items-center justify-center mx-auto mb-2">
            <span className="material-symbols-outlined text-xl text-text-faint-light dark:text-text-faint-dark">folder</span>
        </div>
        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark">
            No folders yet. Create one to organize your courses.
        </p>
    </div>
);

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

    const [{
        collapsed,
        confirmDeleteFolderId,
        creating,
        error,
        menuOpenId,
        newName,
        renameValue,
        renamingId,
        submitting,
    }, dispatchFolderUi] = useReducer(folderUiReducer, undefined, createInitialFolderUiState);
    const menuRefs = useRef(new Map());

    useEffect(() => {
        if (menuOpenId === null) return;
        const handleClickOutside = (event) => {
            const node = menuRefs.current.get(menuOpenId);
            if (node && !node.contains(event.target)) {
                dispatchFolderUi({ type: 'patch', patch: { menuOpenId: null } });
            }
        };
        const handleKey = (event) => {
            if (event.key === 'Escape') dispatchFolderUi({ type: 'patch', patch: { menuOpenId: null } });
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, [menuOpenId]);

    const toggleCollapse = (folderId) => {
        dispatchFolderUi({ type: 'toggleCollapse', folderId });
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!userId) return;
        const trimmed = newName.trim();
        if (!trimmed) {
            dispatchFolderUi({ type: 'patch', patch: { error: 'Please enter a name.' } });
            return;
        }
        dispatchFolderUi({ type: 'patch', patch: { error: '', submitting: true } });
        try {
            await createFolder({ userId, name: trimmed });
            dispatchFolderUi({ type: 'finishCreate' });
        } catch (err) {
            dispatchFolderUi({ type: 'patch', patch: { error: err?.message || 'Could not create folder.' } });
        } finally {
            dispatchFolderUi({ type: 'patch', patch: { submitting: false } });
        }
    };

    const beginRename = (folder) => {
        dispatchFolderUi({ type: 'beginRename', folder });
    };

    const submitRename = async (folder) => {
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === folder.name) {
            dispatchFolderUi({ type: 'finishRename' });
            return;
        }
        try {
            await renameFolder({ folderId: folder._id, userId, name: trimmed });
        } catch (err) {
            dispatchFolderUi({ type: 'patch', patch: { error: err?.message || 'Could not rename folder.' } });
        } finally {
            dispatchFolderUi({ type: 'finishRename' });
        }
    };

    const confirmDeleteFolder = async (folder) => {
        try {
            await deleteFolder({ folderId: folder._id, userId });
            dispatchFolderUi({ type: 'patch', patch: { confirmDeleteFolderId: null } });
        } catch (err) {
            dispatchFolderUi({ type: 'patch', patch: { error: err?.message || 'Could not delete folder.' } });
        }
    };

    return (
        <section className="animate-fade-in-up animate-delay-250 mt-8">
            <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="text-display-sm text-text-main-light dark:text-text-main-dark">Folders</h2>
                {!creating && (
                    <button
                        type="button"
                        onClick={() => dispatchFolderUi({ type: 'beginCreate' })}
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
                        ref={focusMountedInput}
                        type="text"
                        value={newName}
                        onChange={(e) => dispatchFolderUi({ type: 'patch', patch: { newName: e.target.value } })}
                        placeholder="Folder name"
                        maxLength={80}
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
                            onClick={() => dispatchFolderUi({ type: 'cancelCreate' })}
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
                <EmptyFoldersState />
            )}

            <div className="space-y-4">
                {folders.map((folder) => {
                    const coursesInFolder = coursesByFolder.get(folder._id) || [];
                    const isCollapsed = collapsed.has(folder._id);
                    const isRenaming = renamingId === folder._id;
                    const isMenuOpen = menuOpenId === folder._id;
                    const isConfirmingDelete = confirmDeleteFolderId === folder._id;

                    const folderHeader = (
                        <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className="material-symbols-outlined text-[18px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                                {isRenaming ? (
                                    <input
                                        ref={focusMountedInput}
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => dispatchFolderUi({ type: 'patch', patch: { renameValue: e.target.value } })}
                                        onClick={(e) => e.stopPropagation()}
                                        onBlur={() => submitRename(folder)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); submitRename(folder); }
                                            if (e.key === 'Escape') { dispatchFolderUi({ type: 'finishRename' }); }
                                        }}
                                        maxLength={80}
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
                            </div>

                            {isConfirmingDelete ? (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-caption text-red-600 dark:text-red-400">Delete folder?</span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); confirmDeleteFolder(folder); }}
                                        className="text-caption font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >Delete folder</button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); dispatchFolderUi({ type: 'patch', patch: { confirmDeleteFolderId: null } }); }}
                                        className="text-caption text-text-sub-light px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors"
                                    >Keep folder</button>
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
                                        onClick={() => dispatchFolderUi({ type: 'patch', patch: { menuOpenId: isMenuOpen ? null : folder._id } })}
                                        className="btn-icon size-7"
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
                                                onClick={() => dispatchFolderUi({ type: 'patch', patch: { confirmDeleteFolderId: folder._id, menuOpenId: null } })}
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
                    );

                    return (
                        <WatermelonDisclosure
                            key={folder._id}
                            title={folderHeader}
                            open={!isCollapsed}
                            onOpenChange={() => toggleCollapse(folder._id)}
                            className="card-flat overflow-hidden"
                            headerClassName="px-4 py-3"
                            contentClassName="px-4 pb-4"
                        >
                            {coursesInFolder.length === 0 ? (
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
                            )}
                        </WatermelonDisclosure>
                    );
                })}
            </div>
        </section>
    );
};

export default CourseFoldersSection;
