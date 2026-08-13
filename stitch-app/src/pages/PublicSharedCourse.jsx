import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PublicShell from '../components/PublicShell';
import LessonOrderingCheck from '../components/lesson/LessonOrderingCheck';
import AppIcon from '../components/AppIcon';

const renderContent = (content) => {
    const text = String(content || '').trim();
    if (!text) return null;
    const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    return blocks.map((block, index) => {
        if (/^#{1,3}\s+/.test(block)) {
            const heading = block.replace(/^#{1,3}\s+/, '');
            return (
                <h3 key={index} className="mt-6 font-display text-xl font-bold text-[#0A0A0A]">
                    {heading}
                </h3>
            );
        }
        return (
            <p key={index} className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-[#3A3A3C]">
                {block}
            </p>
        );
    });
};

const PublicSharedCourse = () => {
    const { token } = useParams();
    const [course, setCourse] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

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
                if (!cancelled) setCourse(payload.course || null);
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
                    <div className="mt-8 space-y-8">
                        {(Array.isArray(course.topics) ? course.topics : []).map((topic, index) => (
                            <article key={`${topic.title}-${index}`} className="rounded-3xl border border-[#E5E5EA] bg-white p-6 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B6B70]">
                                    Topic {index + 1}
                                </p>
                                <h2 className="mt-1 font-display text-2xl font-bold text-[#0A0A0A]">{topic.title}</h2>
                                {topic.description ? (
                                    <p className="mt-2 text-sm text-[#6B6B70]">{topic.description}</p>
                                ) : null}
                                <div className="mt-4">{renderContent(topic.content)}</div>
                                {topic.orderingCheck ? (
                                    <LessonOrderingCheck check={topic.orderingCheck} />
                                ) : null}
                            </article>
                        ))}
                    </div>
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
