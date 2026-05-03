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

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.epub', '.txt'];

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
    const [isDragOver, setIsDragOver] = React.useState(false);
    const fileInputRef = React.useRef(null);

    const materials = useQuery(api.library.listMaterials, {
        query: searchQuery.trim() || undefined,
        limit: 60,
    });

    const handleFileChange = (file) => {
        setUploadError('');
        setUploadSuccess('');
        setSelectedFile(file);
        if (file && !title.trim()) {
            setTitle(inferTitleFromFile(file.name));
        }
    };

    const onInputChange = (event) => {
        const file = event.target.files?.[0] || null;
        if (file) handleFileChange(file);
    };

    const onDropzoneClick = () => {
        fileInputRef.current?.click();
    };

    const onDragOver = (event) => {
        event.preventDefault();
        setIsDragOver(true);
    };

    const onDragLeave = (event) => {
        event.preventDefault();
        setIsDragOver(false);
    };

    const onDrop = (event) => {
        event.preventDefault();
        setIsDragOver(false);
        const file = event.dataTransfer.files?.[0] || null;
        if (file) handleFileChange(file);
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
        <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12 space-y-8">
            <div>
                <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">Library</h1>
                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                    Upload books and reading materials for everyone to read.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="card-base shadow-card p-5 md:p-6 space-y-5 border-l-[3px] border-l-primary/40 dark:border-l-primary/30">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                        <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">Title</span>
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            className="input-field mt-1.5 text-body-sm"
                            placeholder="e.g. Introduction to Economics"
                            maxLength={160}
                        />
                    </label>
                    <label className="block">
                        <span className="text-caption font-semibold text-text-sub-light dark:text-text-sub-dark">Description</span>
                        <input
                            type="text"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            className="input-field mt-1.5 text-body-sm"
                            placeholder="Short note about course, level, or why it is useful"
                            maxLength={500}
                        />
                    </label>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS.join(',') + ',application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,text/plain'}
                    onChange={onInputChange}
                    className="hidden"
                    aria-hidden="true"
                />

                <button
                    type="button"
                    onClick={onDropzoneClick}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={[
                        'group relative w-full rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-3 py-10 px-4 text-center',
                        isDragOver
                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                            : 'border-border-light dark:border-border-dark hover:border-primary/40 dark:hover:border-primary/40 bg-surface-light dark:bg-surface-dark',
                    ].join(' ')}
                >
                    <div className={[
                        'w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-200',
                        isDragOver
                            ? 'bg-primary/10 dark:bg-primary/20'
                            : 'bg-surface-hover dark:bg-surface-hover-dark group-hover:bg-primary/8 dark:group-hover:bg-primary/15',
                    ].join(' ')}>
                        <span className={[
                            'material-symbols-outlined text-[26px] transition-colors duration-200',
                            isDragOver ? 'text-primary' : 'text-text-faint-light dark:text-text-faint-dark',
                        ].join(' ')}>
                            {selectedFile ? 'check_circle' : 'cloud_upload'}
                        </span>
                    </div>
                    <div>
                        <p className="text-body-sm font-medium text-text-main-light dark:text-text-main-dark">
                            {selectedFile ? selectedFile.name : isDragOver ? 'Drop file to upload' : 'Click or drag file to upload'}
                        </p>
                        <p className="text-caption text-text-faint-light dark:text-text-faint-dark mt-0.5">
                            {selectedFile
                                ? `${formatFileSize(selectedFile.size)} · Click to change`
                                : 'PDF, Word, EPUB, or plain text · Max 20 MB'}
                        </p>
                    </div>
                </button>

                {uploadError && (
                    <p className="text-body-sm font-semibold text-red-600 dark:text-red-400">{uploadError}</p>
                )}
                {uploadSuccess && (
                    <p className="text-body-sm font-semibold text-accent-emerald">{uploadSuccess}</p>
                )}

                <div className="flex items-center justify-between gap-4 pt-1">
                    <p className="text-caption text-text-faint-light dark:text-text-faint-dark hidden md:block">
                        Everyone in the community will be able to read this.
                    </p>
                    <button
                        type="submit"
                        disabled={isUploading}
                        className="btn-primary text-body-sm px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ml-auto"
                    >
                        <span className="material-symbols-outlined text-[17px]">{isUploading ? 'hourglass_empty' : 'library_add'}</span>
                        {isUploading ? 'Uploading...' : 'Share to Library'}
                    </button>
                </div>
            </form>

            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <h2 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">
                        Shared Materials
                    </h2>
                    <div className="relative w-full md:w-72">
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
                    <div className="text-center py-20">
                        <div className="relative w-20 h-20 mx-auto mb-5">
                            <div className="absolute inset-0 rounded-3xl bg-primary/8 dark:bg-primary/15" />
                            <div className="absolute inset-0 rounded-3xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-[32px] text-primary/70 dark:text-primary/60">
                                    local_library
                                </span>
                            </div>
                        </div>
                        <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1.5">
                            No shared materials yet
                        </h2>
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-sm mx-auto leading-relaxed">
                            Add the first book, handout, or reading pack so other students can open it here.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardSearch;
