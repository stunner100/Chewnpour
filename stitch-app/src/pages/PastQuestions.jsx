import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import {
    buildPastQuestionsQuery,
    describePaper,
    groupPapersByCourse,
    listPaperYears,
    resolvePracticeOutcome,
} from '../lib/pastQuestions';

const fieldClass = 'w-full rounded-full border border-border-default bg-surface-soft px-4 py-3 text-body-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-soft';

const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
    }
    return payload;
};

const PaperRow = ({ paper, busy, onOpen, onDownload, onPractice }) => (
    <li className="flex flex-col gap-3 border-t border-border-subtle py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
            <p className="text-body-sm font-semibold text-text-primary">{describePaper(paper)}</p>
            <p className="text-caption uppercase tracking-wide text-text-muted">
                {paper.canPractice ? paper.fileType : 'Picture'}
            </p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button
                type="button"
                className="btn-secondary inline-flex min-h-11 items-center gap-1.5 px-4 text-body-sm"
                onClick={() => onOpen(paper)}
                disabled={Boolean(busy)}
            >
                <AppIcon name="visibility" className="text-[16px]" />
                View
            </button>
            <button
                type="button"
                className="btn-secondary inline-flex min-h-11 items-center gap-1.5 px-4 text-body-sm"
                onClick={() => onDownload(paper)}
                disabled={Boolean(busy)}
                aria-label={`Download ${paper.courseCode} ${describePaper(paper)}`}
            >
                <AppIcon name="download" className="text-[16px]" />
                Download
            </button>
            {paper.canPractice ? (
                <button
                    type="button"
                    className="btn-primary inline-flex min-h-11 items-center gap-1.5 px-4 text-body-sm"
                    onClick={() => onPractice(paper)}
                    disabled={Boolean(busy)}
                >
                    <AppIcon name={busy === 'practice' ? 'progress_activity' : 'timer'} className={`text-[16px] ${busy === 'practice' ? 'animate-spin' : ''}`} />
                    {busy === 'practice' ? 'Preparing…' : 'Practise as exam'}
                </button>
            ) : null}
        </div>
    </li>
);

const PastQuestions = () => {
    const navigate = useNavigate();
    const [papers, setPapers] = useState([]);
    const [institutions, setInstitutions] = useState([]);
    const [institution, setInstitution] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [year, setYear] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(null);
    const [busy, setBusy] = useState({});

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 250);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        requestJson(buildPastQuestionsQuery({ institution, q: debouncedSearch }))
            .then((payload) => {
                if (cancelled) return;
                setPapers(Array.isArray(payload.papers) ? payload.papers : []);
                setInstitutions(Array.isArray(payload.institutions) ? payload.institutions : []);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message || 'Could not load past questions.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [institution, debouncedSearch]);

    const years = useMemo(() => listPaperYears(papers), [papers]);
    const groups = useMemo(() => groupPapersByCourse(papers, { year }), [papers, year]);
    const hasFilters = Boolean(institution || search || year);

    const setPaperBusy = (id, value) => setBusy((current) => ({ ...current, [id]: value }));

    const openFile = async (paper, { download }) => {
        // Open the tab synchronously so popup blockers allow it.
        const tab = download ? null : window.open('', '_blank');
        setPaperBusy(paper.id, download ? 'download' : 'view');
        setNotice(null);
        try {
            const file = await requestJson(
                `/api/past-questions/${encodeURIComponent(paper.id)}/file${download ? '?download=1' : ''}`,
            );
            if (tab) {
                tab.opener = null;
                tab.location.href = file.url;
            } else {
                window.location.assign(file.url);
            }
        } catch (err) {
            tab?.close();
            setNotice({ tone: 'error', message: err.message || 'Could not open this paper.' });
        } finally {
            setPaperBusy(paper.id, null);
        }
    };

    const practice = async (paper) => {
        setPaperBusy(paper.id, 'practice');
        setNotice(null);
        try {
            const result = await requestJson(
                `/api/past-questions/${encodeURIComponent(paper.id)}/practice`,
                { method: 'POST' },
            );
            const outcome = resolvePracticeOutcome(result);
            if (outcome.kind === 'ready') {
                navigate(outcome.href);
                return;
            }
            setNotice({
                tone: outcome.kind === 'processing' ? 'info' : 'error',
                message: outcome.message,
                href: outcome.href,
            });
        } catch (err) {
            setNotice({ tone: 'error', message: err.message || 'Could not prepare this paper.' });
        } finally {
            setPaperBusy(paper.id, null);
        }
    };

    return (
        <div className="min-h-[calc(100dvh-4rem)] bg-background-light px-4 py-8 pb-24 md:px-8 md:py-10 md:pb-12">
            <div className="mx-auto max-w-4xl">
                <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                    Past questions
                </h1>
                <p className="mt-2 max-w-xl text-pretty text-body-md text-text-secondary">
                    Browse past exam papers by school, course, and year. Open or download a paper, or practise it as a timed exam.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-[2fr_1.5fr_1fr]">
                    <label className="relative block">
                        <span className="sr-only">Search by course code or title</span>
                        <AppIcon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-text-muted" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Course code or title, e.g. CSC 201"
                            className={`${fieldClass} pl-11`}
                        />
                    </label>
                    <label className="block">
                        <span className="sr-only">Institution</span>
                        <select
                            value={institution}
                            onChange={(event) => setInstitution(event.target.value)}
                            className={`${fieldClass} cursor-pointer`}
                        >
                            <option value="">All institutions</option>
                            {institutions.map((item) => (
                                <option key={item.name} value={item.name}>
                                    {item.name} ({item.count})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="block">
                        <span className="sr-only">Year</span>
                        <select
                            value={year}
                            onChange={(event) => setYear(event.target.value)}
                            className={`${fieldClass} cursor-pointer`}
                        >
                            <option value="">All years</option>
                            {years.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {notice ? (
                    <div
                        role={notice.tone === 'error' ? 'alert' : 'status'}
                        className={`mt-5 rounded-[16px] border px-4 py-3 text-body-sm ${notice.tone === 'error'
                            ? 'border-error/30 bg-error-soft text-error'
                            : 'border-border-subtle bg-surface text-text-secondary'}`}
                    >
                        {notice.message}
                        {notice.href ? (
                            <Link to={notice.href} className="ml-2 font-semibold text-primary underline-offset-2 hover:underline">
                                Open My Materials
                            </Link>
                        ) : null}
                    </div>
                ) : null}

                {error ? (
                    <div role="alert" className="mt-5 rounded-[16px] border border-error/30 bg-error-soft px-4 py-3 text-body-sm text-error">
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="mt-6 space-y-4" aria-busy="true">
                        {[0, 1, 2].map((key) => (
                            <div key={key} className="h-32 animate-pulse rounded-[20px] bg-surface-soft" />
                        ))}
                    </div>
                ) : !error && groups.length === 0 ? (
                    <div className="mx-auto mt-10 flex w-full max-w-xl flex-col items-center rounded-[28px] border border-dashed border-border-default bg-surface px-6 py-12 text-center shadow-sm">
                        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-soft text-text-muted">
                            <AppIcon name={hasFilters ? 'search_off' : 'auto_stories'} className="text-[28px]" />
                        </div>
                        <h2 className="font-display text-display-sm font-bold text-text-primary">
                            {hasFilters ? 'No papers match' : 'No past questions yet'}
                        </h2>
                        <p className="mt-2 max-w-sm text-body-sm text-text-secondary">
                            {hasFilters
                                ? 'Try another course code, institution, or year.'
                                : 'We are adding past papers. Check back soon.'}
                        </p>
                    </div>
                ) : (
                    <ul className="mt-6 space-y-4">
                        {groups.map((group) => (
                            <li key={group.key} className="rounded-[20px] border border-border-subtle bg-surface p-4 shadow-sm md:p-5">
                                <div className="mb-2">
                                    <h2 className="text-body-lg font-semibold text-text-primary">
                                        {group.courseCode}
                                        {group.courseTitle ? (
                                            <span className="font-normal text-text-secondary"> · {group.courseTitle}</span>
                                        ) : null}
                                    </h2>
                                    <p className="text-caption text-text-muted">{group.institution}</p>
                                </div>
                                <ul>
                                    {group.papers.map((paper) => (
                                        <PaperRow
                                            key={paper.id}
                                            paper={paper}
                                            busy={busy[paper.id]}
                                            onOpen={(item) => openFile(item, { download: false })}
                                            onDownload={(item) => openFile(item, { download: true })}
                                            onPractice={practice}
                                        />
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default PastQuestions;
