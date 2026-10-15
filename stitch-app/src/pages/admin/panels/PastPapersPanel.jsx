import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SectionCard } from '../../../components/admin/AdminUi';
import { formatBytes, formatDateTime } from '../../../lib/admin/formatters';
import { putFileWithProgress } from '../../../lib/uploadTransfer';
import { describePaper } from '../../../lib/pastQuestions';

const inputClass = 'w-full rounded-lg border border-border-default bg-surface-soft px-3 py-2 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft';

const EMPTY_FORM = {
    institution: '',
    courseCode: '',
    courseTitle: '',
    year: String(new Date().getFullYear() - 1),
    semester: '',
    level: '',
    publish: true,
};

const adminRequest = async (url, options = {}) => {
    const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
    }
    return payload;
};

const Field = ({ label, children }) => (
    <label className="block text-sm">
        <span className="mb-1 block font-medium text-text-secondary">{label}</span>
        {children}
    </label>
);

export const PastPapersPanel = () => {
    const [papers, setPapers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [file, setFile] = useState(null);
    const [progress, setProgress] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [rowBusy, setRowBusy] = useState('');
    const fileInputRef = useRef(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const payload = await adminRequest('/api/admin/past-papers');
            setPapers(Array.isArray(payload.papers) ? payload.papers : []);
        } catch (err) {
            setError(err.message || 'Could not load past papers.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const update = (key) => (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setForm((current) => ({ ...current, [key]: value }));
    };

    const submit = async (event) => {
        event.preventDefault();
        if (!file) {
            setError('Choose a PDF or DOCX file.');
            return;
        }
        setSubmitting(true);
        setError('');
        setProgress(0);
        try {
            const init = await adminRequest('/api/admin/past-papers/init', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    year: Number(form.year),
                    fileName: file.name,
                    fileSize: file.size,
                    contentType: file.type,
                }),
            });
            await putFileWithProgress({
                url: init.signedUrl,
                file,
                contentType: init.contentType,
                onProgress: setProgress,
            });
            if (form.publish) {
                await adminRequest(`/api/admin/past-papers/${encodeURIComponent(init.paper.id)}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: 'published' }),
                });
            }
            setForm((current) => ({ ...EMPTY_FORM, institution: current.institution, year: current.year }));
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await load();
        } catch (err) {
            setError(err.message || 'Upload failed.');
        } finally {
            setSubmitting(false);
            setProgress(null);
        }
    };

    const setStatus = async (paper, status) => {
        setRowBusy(paper.id);
        setError('');
        try {
            const payload = await adminRequest(`/api/admin/past-papers/${encodeURIComponent(paper.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            });
            setPapers((current) => current.map((item) => (item.id === paper.id ? payload.paper : item)));
        } catch (err) {
            setError(err.message || 'Could not update paper.');
        } finally {
            setRowBusy('');
        }
    };

    const remove = async (paper) => {
        if (!window.confirm(`Delete ${paper.courseCode} ${describePaper(paper)}? This removes the file.`)) return;
        setRowBusy(paper.id);
        setError('');
        try {
            await adminRequest(`/api/admin/past-papers/${encodeURIComponent(paper.id)}`, { method: 'DELETE' });
            setPapers((current) => current.filter((item) => item.id !== paper.id));
        } catch (err) {
            setError(err.message || 'Could not delete paper.');
        } finally {
            setRowBusy('');
        }
    };

    return (
        <div className="space-y-6">
            <SectionCard title="Add a past paper">
                <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Institution">
                        <input required value={form.institution} onChange={update('institution')} className={inputClass} placeholder="University of Ghana" list="past-paper-institutions" />
                        <datalist id="past-paper-institutions">
                            {Array.from(new Set(papers.map((paper) => paper.institution))).map((name) => (
                                <option key={name} value={name} />
                            ))}
                        </datalist>
                    </Field>
                    <Field label="Course code">
                        <input required value={form.courseCode} onChange={update('courseCode')} className={inputClass} placeholder="CSCD 201" />
                    </Field>
                    <Field label="Course title">
                        <input value={form.courseTitle} onChange={update('courseTitle')} className={inputClass} placeholder="Data Structures" />
                    </Field>
                    <Field label="Year">
                        <input required type="number" min="1950" value={form.year} onChange={update('year')} className={inputClass} />
                    </Field>
                    <Field label="Semester / exam type">
                        <input value={form.semester} onChange={update('semester')} className={inputClass} placeholder="First semester" list="past-paper-semesters" />
                        <datalist id="past-paper-semesters">
                            <option value="First semester" />
                            <option value="Second semester" />
                            <option value="Mid-semester" />
                            <option value="Resit" />
                        </datalist>
                    </Field>
                    <Field label="Level">
                        <input value={form.level} onChange={update('level')} className={inputClass} placeholder="200" />
                    </Field>
                    <Field label="File (PDF or DOCX, max 50MB)">
                        <input
                            ref={fileInputRef}
                            required
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(event) => setFile(event.target.files?.[0] || null)}
                            className="block w-full text-sm text-text-secondary"
                        />
                    </Field>
                    <label className="flex items-center gap-2 self-end text-sm text-text-secondary">
                        <input type="checkbox" checked={form.publish} onChange={update('publish')} />
                        Publish immediately
                    </label>
                    <div className="flex items-end">
                        <button type="submit" className="btn-primary min-h-11 px-5" disabled={submitting}>
                            {submitting
                                ? progress != null && progress < 100 ? `Uploading ${progress}%` : 'Saving…'
                                : 'Add paper'}
                        </button>
                    </div>
                </form>
                {error ? (
                    <p role="alert" className="mt-4 text-sm text-error">{error}</p>
                ) : null}
            </SectionCard>

            <SectionCard title="Past papers" badge={loading ? 'Loading…' : `${papers.length} total`}>
                {papers.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[44rem] text-left text-sm">
                            <caption className="sr-only">Past papers</caption>
                            <thead>
                                <tr className="border-b border-border-subtle text-text-muted">
                                    <th className="py-2 pr-3 font-medium">Course</th>
                                    <th className="py-2 pr-3 font-medium">Institution</th>
                                    <th className="py-2 pr-3 font-medium">Paper</th>
                                    <th className="py-2 pr-3 font-medium">Status</th>
                                    <th className="py-2 pr-3 font-medium">Added</th>
                                    <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {papers.map((paper) => (
                                    <tr key={paper.id} className="border-b border-border-subtle last:border-0">
                                        <td className="py-2.5 pr-3 font-medium text-text-primary">
                                            {paper.courseCode}
                                            {paper.courseTitle ? <span className="block text-xs font-normal text-text-muted">{paper.courseTitle}</span> : null}
                                        </td>
                                        <td className="py-2.5 pr-3 text-text-secondary">{paper.institution}</td>
                                        <td className="py-2.5 pr-3 text-text-secondary">
                                            {describePaper(paper)}
                                            <span className="block text-xs text-text-muted">{paper.fileType?.toUpperCase()} · {formatBytes(paper.fileSize)}</span>
                                        </td>
                                        <td className="py-2.5 pr-3 text-text-secondary">{paper.status}</td>
                                        <td className="py-2.5 pr-3 text-text-secondary">{formatDateTime(paper.createdAt)}</td>
                                        <td className="py-2.5 text-right whitespace-nowrap">
                                            <button
                                                type="button"
                                                className="btn-secondary min-h-9 px-3 text-xs"
                                                disabled={rowBusy === paper.id}
                                                onClick={() => setStatus(paper, paper.status === 'published' ? 'draft' : 'published')}
                                            >
                                                {paper.status === 'published' ? 'Unpublish' : 'Publish'}
                                            </button>
                                            <button
                                                type="button"
                                                className="ml-2 min-h-9 px-3 text-xs font-semibold text-error"
                                                disabled={rowBusy === paper.id}
                                                onClick={() => remove(paper)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-sm text-text-secondary">{loading ? 'Loading past papers…' : 'No past papers yet.'}</p>
                )}
            </SectionCard>
        </div>
    );
};
