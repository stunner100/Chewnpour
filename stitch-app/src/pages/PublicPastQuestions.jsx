import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicShell from '../components/PublicShell';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Public past question pages (signed out, indexable): a course index and a
// page per course code. Papers open only inside the app, so every page ends
// in a sign-up (or dashboard) call to action.
// Public pages are always light; explicit colours keep the app's dark theme
// classes from repainting them.
const CARD_STYLE = { background: '#FFFFFF', borderColor: '#E5E5EA', color: '#0A0A0A' };

const usePublicJson = (url) => {
    // Loading until a result for this exact url arrives.
    const [result, setResult] = useState({ url: '', data: null, error: '' });
    useEffect(() => {
        let cancelled = false;
        fetch(url, { headers: { Accept: 'application/json' } })
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(payload.error || 'Could not load past questions');
                if (!cancelled) setResult({ url, data: payload, error: '' });
            })
            .catch((error) => {
                if (!cancelled) setResult({ url, data: null, error: error.message });
            });
        return () => {
            cancelled = true;
        };
    }, [url]);
    const current = result.url === url;
    return { loading: !current, data: current ? result.data : null, error: current ? result.error : '' };
};

const CallToAction = ({ signedIn }) => (
    <section className="mt-8 rounded-[24px] px-6 py-8" style={{ background: '#0A0A0A', color: '#FFFFFF' }}>
        <h2 className="text-xl font-semibold">Practise these papers as a timed exam</h2>
        <p className="mt-2 max-w-xl text-sm text-white/75">
            Open any paper, practise it against the clock, and upload your own lecture notes to get lessons, quizzes and an AI tutor. ChewnPour is free.
        </p>
        <Link
            to={signedIn ? '/dashboard/past-questions' : '/signup'}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
            style={{ background: '#FFFFFF', color: '#0A0A0A' }}
        >
            {signedIn ? 'Open past questions' : 'Sign up free'}
            <AppIcon name="arrow_forward" className="text-[16px]" aria-hidden="true" />
        </Link>
    </section>
);

const StateMessage = ({ loading, error, empty }) => {
    if (loading) return <div className="mt-6 h-40 animate-pulse rounded-2xl" style={{ background: '#EDEDF0' }} />;
    if (error) return <p role="alert" className="mt-6 text-sm text-[#B42318]">{error}</p>;
    return <p className="mt-6 text-sm text-[#6B6B70]">{empty}</p>;
};

const CourseIndex = ({ signedIn }) => {
    const { loading, data, error } = usePublicJson('/api/public/past-questions');
    useDocumentTitle('Past questions');
    const groups = useMemo(() => {
        const byInstitution = new Map();
        for (const course of data?.courses || []) {
            const list = byInstitution.get(course.institution) || [];
            list.push(course);
            byInstitution.set(course.institution, list);
        }
        return [...byInstitution.entries()];
    }, [data]);

    return (
        <>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">University past questions</h1>
            <p className="mt-3 max-w-2xl text-[#6B6B70]">
                Past exam papers from Ghanaian universities, by course code. Practise them as timed exams on ChewnPour.
            </p>
            {groups.length === 0 ? (
                <StateMessage loading={loading} error={error} empty="No past questions are published yet." />
            ) : (
                groups.map(([institution, courses]) => (
                    <section key={institution} className="mt-8">
                        <h2 className="text-lg font-semibold">{institution}</h2>
                        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                            {courses.map((course) => (
                                <li key={`${institution}-${course.courseCode}`}>
                                    <Link
                                        to={`/past-questions/${encodeURIComponent(course.slug)}`}
                                        className="flex min-h-11 flex-col rounded-2xl border px-4 py-3"
                                        style={CARD_STYLE}
                                    >
                                        <span className="font-semibold">{course.courseCode}{course.courseTitle ? ` · ${course.courseTitle}` : ''}</span>
                                        <span className="mt-0.5 text-sm text-[#6B6B70]">
                                            {course.paperCount} {course.paperCount === 1 ? 'paper' : 'papers'}
                                            {course.latestYear ? ` · latest ${course.latestYear}` : ''}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))
            )}
            <CallToAction signedIn={signedIn} />
        </>
    );
};

const CoursePapers = ({ slug, signedIn }) => {
    const { loading, data, error } = usePublicJson(`/api/public/past-questions/${encodeURIComponent(slug)}`);
    const papers = data?.papers || [];
    const first = papers[0];
    const heading = first
        ? `${first.courseCode}${first.courseTitle ? ` ${first.courseTitle}` : ''} past questions`
        : `${slug.toUpperCase()} past questions`;
    useDocumentTitle(heading);

    return (
        <>
            <Link to="/past-questions" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#007AFF]">
                <AppIcon name="arrow_back" className="text-[16px]" aria-hidden="true" />
                All past questions
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
            {first && <p className="mt-3 text-[#6B6B70]">{first.institution}</p>}
            {papers.length === 0 ? (
                <StateMessage loading={loading} error={error} empty="No published papers for this course code yet." />
            ) : (
                <ul className="mt-6 divide-y divide-[#E5E5EA] rounded-2xl border" style={CARD_STYLE}>
                    {papers.map((paper) => (
                        <li key={paper.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                            <span className="font-medium">
                                {paper.year}{paper.semester ? ` · ${paper.semester}` : ''}{paper.level ? ` · Level ${paper.level}` : ''}
                            </span>
                            <span className="text-sm text-[#6B6B70]">
                                {paper.canPractice ? 'Practise as a timed exam' : 'View and download'}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <CallToAction signedIn={signedIn} />
        </>
    );
};

const PublicPastQuestions = () => {
    const { courseCode } = useParams();
    const { user } = useAuth();
    const signedIn = Boolean(user?.id);
    return (
        <PublicShell>
            <div className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
                {courseCode
                    ? <CoursePapers slug={courseCode} signedIn={signedIn} />
                    : <CourseIndex signedIn={signedIn} />}
            </div>
        </PublicShell>
    );
};

export default PublicPastQuestions;
