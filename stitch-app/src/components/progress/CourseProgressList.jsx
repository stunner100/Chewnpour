import React from 'react';
import { m as Motion, useReducedMotion } from 'motion/react';
import AppIcon from '../AppIcon';
import { buildCourseRows } from './progressModel';

/**
 * Per-course practice coverage: how many topics in each course have a quiz attempt.
 */
const CourseProgressList = ({ courses }) => {
    const reduceMotion = useReducedMotion();
    const rows = buildCourseRows(courses);

    return (
        <Motion.section
            aria-labelledby="progress-courses-heading"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: reduceMotion ? 0 : 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6"
        >
            <div className="flex items-center gap-2">
                <AppIcon name="auto_stories" className="text-[20px] text-primary" />
                <h2
                    id="progress-courses-heading"
                    className="font-display text-display-sm font-bold text-text-primary"
                >
                    Courses
                </h2>
            </div>
            {rows.length > 0 ? (
                <ul className="mt-5 flex flex-col gap-3">
                    {rows.map((course) => (
                        <li
                            key={course.id}
                            className="rounded-[18px] border border-border-subtle bg-surface-variant p-4"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="line-clamp-1 text-body-md font-semibold text-text-primary">
                                        {course.title}
                                    </p>
                                    <p className="mt-1 text-caption text-text-muted">
                                        {course.practiced} of {course.topicCount}{' '}
                                        {course.topicCount === 1 ? 'topic' : 'topics'} practiced
                                    </p>
                                </div>
                                <span className="shrink-0 text-body-sm font-semibold text-primary">
                                    {course.progress}%
                                </span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-soft">
                                <div
                                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                                    style={{ width: `${course.progress}%` }}
                                    role="progressbar"
                                    aria-label={`${course.title} topics practiced`}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={course.progress}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-4 text-body-sm text-text-muted">
                    Your courses will appear here after your first generated lesson.
                </p>
            )}
        </Motion.section>
    );
};

export default CourseProgressList;
