import React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { uploadToStorageWithRetry } from '../lib/uploadNetworkResilience';

const ACCEPTED_LIBRARY_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/epub+zip',
    'text/plain',
];

const formatFileSize = (size) => {
    const bytes = Number(size || 0);
    if (!bytes) return 'Unknown size';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

const inferTitleFromFile = (fileName) =>
    String(fileName || '')
        .replace(/\.(pdf|docx?|epub|txt)$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getFileTypeLabel = (material) => {
    const name = String(material?.fileName || '').toLowerCase();
    if (name.endsWith('.pdf')) return 'PDF';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'Word';
    if (name.endsWith('.epub')) return 'EPUB';
    if (name.endsWith('.txt')) return 'Text';
    return material?.fileType?.split('/').pop()?.toUpperCase() || 'File';
};

const LibraryMaterialCard = ({ material }) => (
    <article className="card-base p-4 md:p-5 flex flex-col gap-4">
        <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/8 dark:bg-primary/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px] text-primary">menu_book</span>
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark leading-snug line-clamp-2">
                        {material.title}
                    </h2>
                    <span className="badge badge-primary shrink-0">{getFileTypeLabel(material)}</span>
                </div>
                <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-1">
                    Shared by {material.uploaderName} · {new Date(material.createdAt).toLocaleDateString()} · {formatFileSize(material.fileSize)}
                </p>
            </div>
        </div>

        {material.description && (
            <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark line-clamp-3">
                {material.description}
            </p>
        )}

        <div className="flex items-center gap-2 mt-auto">
            <a
                href={material.fileUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="btn-primary text-body-sm px-4 py-2 inline-flex items-center gap-2"
                aria-disabled={!material.fileUrl}
            >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Read
            </a>
            <span className="text-caption text-text-faint-light dark:text-text-faint-dark truncate">
                {material.fileName}
            </span>
        </div>
    </article>
);

const DashboardSearch = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const generateUploadUrl = useMutation(api.library.generateMaterialUploadUrl);
    const createMaterial = useMutation(api.library.createMaterial);

    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedFile, setSelectedFile] = React.useState(null);
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [uploadError, setUploadError] = React.useState('');
    const [uploadSuccess, setUploadSuccess] = React.useState('');
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef(null);

    const materials = useQuery(api.library.listMaterials, {
        query: searchQuery.trim() || undefined,
        limit: 60,
    });

    const handleFileChange = (event) => {
        const file = event.target.files?.[0] || null;
        setUploadError('');
        setUploadSuccess('');
        setSelectedFile(file);
        if (file && !title.trim()) {
            setTitle(inferTitleFromFile(file.name));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setUploadError('');
        setUploadSuccess('');

        if (!userId) {
            setUploadError('Please sign in to upload library materials.');
            return;
        }
        if (!selectedFile) {
            setUploadError('Choose a book or reading material to upload.');
            return;
        }
        if (!title.trim()) {
            setUploadError('Add a title so other students know what this is.');
            return;
        }
        if (selectedFile.type && !ACCEPTED_LIBRARY_TYPES.includes(selectedFile.type)) {
            setUploadError('Upload a PDF, Word document, EPUB, or text file.');
            return;
        }

        setIsUploading(true);
        try {
            const uploadUrl = await generateUploadUrl();
            const storageId = await uploadToStorageWithRetry({
                uploadUrl,
                file: selectedFile,
                contentType: selectedFile.type || 'application/octet-stream',
                maxAttempts: 3,
            });

            await createMaterial({
                userId,
                title: title.trim(),
                description: description.trim() || undefined,
                fileName: selectedFile.name,
                fileType: selectedFile.type || undefined,
                fileSize: selectedFile.size,
                storageId,
            });

            setSelectedFile(null);
            setTitle('');
            setDescription('');
            setUploadSuccess('Material added to the shared library.');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            setUploadError(error?.data?.message || error?.message || 'Could not upload this material.');
        } finally {
            setIsUploading(false);
        }
    };

    const isLoading = materials === undefined;
    const hasMaterials = Array.isArray(materials) && materials.length > 0;

    return (
        <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">Library</h1>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                        Upload books and reading materials for everyone to read.
                    </p>
                </div>
                <div className="relative w-full md:w-80">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-text-faint-light dark:text-text-faint-dark">search</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search shared materials..."
                        className="input-field pl-10 text-body-sm"
                        aria-label="Search shared library materials"
                    />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="card-base p-4 md:p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[20px] text-accent-emerald">upload_file</span>
                    </div>
                    <div>
                        <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                            Add reading material
                        </h2>
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                            PDF, Word, EPUB, and text files are visible to everyone in the library.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block">
                        <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">Title</span>
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="input-field mt-1 text-body-sm"
                            placeholder="e.g. Introduction to Economics"
                            maxLength={160}
                        />
                    </label>
                    <label className="block">
                        <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">File</span>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.epub,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,text/plain"
                            onChange={handleFileChange}
                            className="input-field mt-1 text-body-sm file:mr-3 file:border-0 file:bg-transparent file:text-primary file:font-semibold"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">Description</span>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="input-field mt-1 h-24 resize-none text-body-sm"
                        placeholder="Add a short note about the course, level, or why this is useful."
                        maxLength={500}
                    />
                </label>

                {selectedFile && (
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark">
                        Selected: {selectedFile.name} · {formatFileSize(selectedFile.size)}
                    </p>
                )}
                {uploadError && (
                    <p className="text-body-sm font-semibold text-red-600 dark:text-red-400">{uploadError}</p>
                )}
                {uploadSuccess && (
                    <p className="text-body-sm font-semibold text-accent-emerald">{uploadSuccess}</p>
                )}

                <button
                    type="submit"
                    disabled={isUploading}
                    className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-[17px]">{isUploading ? 'hourglass_empty' : 'library_add'}</span>
                    {isUploading ? 'Uploading...' : 'Share to Library'}
                </button>
            </form>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="card-base h-40 animate-pulse bg-surface-hover-light dark:bg-surface-hover-dark" />
                    ))}
                </div>
            ) : hasMaterials ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {materials.map((material) => (
                        <LibraryMaterialCard key={material._id} material={material} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-text-faint-light dark:text-text-faint-dark">
                            local_library
                        </span>
                    </div>
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                        No shared materials yet
                    </h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-sm mx-auto">
                        Add the first book, handout, or reading pack so other students can open it here.
                    </p>
                </div>
            )}
        </div>
    );
};

export default DashboardSearch;
