import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicShell from '../components/PublicShell';
import LessonSectionStepper from '../components/lesson/LessonSectionStepper';
import AppIcon from '../components/AppIcon';
import { splitMarkdownIntoSections, buildLessonSteps } from '../lib/lessonSections';

const PublicSharedCourse = () => {
    const { token } = useParams();
    const [course, setCourse] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTopicIndex, setActiveTopicIndex] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetch(`/api/share/${encodeURIComponent(token || '')}`, {
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload.error || 'This shared course is unavailable.');
                }
                if (!cancelled) {
                    setCourse(payload.course || null);
                    setActiveTopicIndex(0);
                }
            } catch (err) {
                if (!cancelled) {
                    setCourse(null);
                    setError(err.message || 'Could not load this shared course.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const topics = Array.isArray(course?.topics) ? course.topics : [];
    const topic = topics[activeTopicIndex] || null;
    const lessonSteps = useMemo(() => {
        if (!topic) return [];
        return buildLessonSteps({
            sections: splitMarkdownIntoSections(topic.content),
            checks: topic.inLessonChecks || [],
            wordBankTerms: [],
            studyMode: 'full',
        });
    }, [topic]);

    return (
        <PublicShell>
            {loading ? (
                <div className="mx-auto max-w-3xl animate-pulse space-y-4">
                    <div className="h-10 rounded-2xl bg-[#E5E5EA]" />
                    <div className="h-40 rounded-3xl bg-[#E5E5EA]" />
                </div>
            ) : error || !course ? (
                <div className="mx-auto max-w-xl rounded-3xl border border-[#E5E5EA] bg-white p-8 text-center">
                    <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">Course not available</h1>
                    <p className="mt-2 text-sm text-[#6B6B70]">
                        {error || 'This share link is invalid or has been turned off.'}
                    </p>
                    <Link to="/signup" className="mt-6 inline-flex h-10 items-center rounded-full bg-[#111] px-4 text-sm font-semibold text-white">
                        Study on ChewnPour
                    </Link>
                </div>
            ) : (
                <div className="mx-auto max-w-3xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B6B70]">Shared lesson</p>
                    <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-[#0A0A0A]">
                        {course.title}
                    </h1>
                    {course.description ? (
                        <p className="mt-3 text-base text-[#6B6B70]">{course.description}</p>
                    ) : null}
                    {topics.length > 1 ? (
                        <div className="mt-6 flex flex-wrap gap-2">
                            {topics.map((entry, index) => (
                                <button
                                    key={entry.id || entry.title}
                                    type="button"
                                    onClick={() => setActiveTopicIndex(index)}
                                    className={`rounded-full px-3 py-1.5 text-sm ${
                                        index === activeTopicIndex
                                            ? 'bg-[#111] text-white'
                                            : 'bg-white text-[#3A3A3C] border border-[#E5E5EA]'
                                    }`}
                                >
                                    {index + 1}. {entry.title}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    {topic ? (
                        <article className="mt-8 rounded-3xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6B70]">
                                Topic {activeTopicIndex + 1} of {topics.length}
                            </p>
                            <h2 className="mt-1 font-display text-2xl font-bold text-[#0A0A0A]">{topic.title}</h2>
                            {topic.description ? (
                                <p className="mt-2 text-sm text-[#6B6B70]">{topic.description}</p>
                            ) : null}
                            <div className="mt-6">
                                <LessonSectionStepper
                                    key={topic.id || token}
                                    steps={lessonSteps}
                                    topicId={topic.id}
                                    shareToken={token}
                                    lessonChecks={{}}
                                    cleanInline={(text) => text}
                                />
                            </div>
                        </article>
                    ) : null}
                    <div className="mt-10 flex items-center gap-2 rounded-2xl border border-[#E5E5EA] bg-white px-5 py-4">
                        <AppIcon name="menu_book" className="text-[20px] text-[#007AFF]" />
                        <p className="text-sm text-[#6B6B70]">
                            Want quizzes and notes on your own uploads?{' '}
                            <Link to="/signup" className="font-semibold text-[#007AFF]">
                                Create a free account
                            </Link>
                        </p>
                    </div>
                </div>
            )}
        </PublicShell>
    );
};

export default PublicSharedCourse;
