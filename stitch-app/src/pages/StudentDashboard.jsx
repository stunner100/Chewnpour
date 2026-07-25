import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppIcon from '../components/AppIcon';

const firstName = (value) => {
  const text = String(value || '').trim();
  if (!text) return 'there';
  return text.split(/\s+/)[0];
};

const courseHref = (course) => {
  if (!course?.id) return '/dashboard/lessons';
  return `/dashboard/lessons?courseId=${encodeURIComponent(course.id)}`;
};

const StudentDashboard = () => {
  const { user, profile } = useAuth();
  const displayName = firstName(profile?.fullName || user?.name || user?.email);
  const onboardingDone = profile?.onboardingCompleted === true;

  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [resumeTarget, setResumeTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!user?.id) {
      setCourses([]);
      setUploads([]);
      setResumeTarget(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [coursesRes, uploadsRes, progressRes] = await Promise.all([
        fetch('/api/courses', { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch('/api/uploads', { credentials: 'include', headers: { Accept: 'application/json' } }),
        fetch('/api/progress', { credentials: 'include', headers: { Accept: 'application/json' } }),
      ]);
      const coursesPayload = await coursesRes.json().catch(() => ({}));
      const uploadsPayload = await uploadsRes.json().catch(() => ({}));
      const progressPayload = await progressRes.json().catch(() => ({}));
      if (!coursesRes.ok) throw new Error(coursesPayload.error || 'Failed to load courses');
      if (!uploadsRes.ok) throw new Error(uploadsPayload.error || 'Failed to load uploads');
      setCourses(Array.isArray(coursesPayload.courses) ? coursesPayload.courses : []);
      setUploads(Array.isArray(uploadsPayload.uploads) ? uploadsPayload.uploads : []);
      setResumeTarget(progressPayload?.progress?.resumeTarget || null);
    } catch (err) {
      setError(err.message || 'Could not load your study home');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const continueCourse = useMemo(() => {
    if (resumeTarget?.courseId) {
      const match = courses.find((course) => String(course.id) === String(resumeTarget.courseId));
      if (match) return match;
      return {
        id: resumeTarget.courseId,
        title: resumeTarget.title || resumeTarget.courseTitle || 'Continue learning',
      };
    }
    return courses[0] || null;
  }, [courses, resumeTarget]);

  const recentUploads = useMemo(() => uploads.slice(0, 3), [uploads]);
  const readyCourses = courses.filter((course) => Number(course.topicCount || 0) > 0).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background-light px-space-4 py-space-8 md:px-space-8 md:py-space-10">
      <section className="mx-auto max-w-4xl">
        <p className="text-body-sm font-medium text-text-secondary">Welcome back</p>
        <h1 className="mt-2 font-display text-display-md font-bold text-text-primary md:text-display-lg">
          {displayName}
        </h1>
        <p className="mt-3 max-w-2xl text-body-md text-text-secondary">
          Upload material, study generated lessons, practice quizzes, and ask the AI tutor. That is the live study loop today.
        </p>

        {!onboardingDone && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-primary-subtle px-space-5 py-space-4">
            <div>
              <p className="font-semibold text-text-primary">Finish setting up your profile</p>
              <p className="mt-1 text-body-sm text-text-secondary">
                Add your education details so recommendations stay relevant.
              </p>
            </div>
            <Link to="/dashboard/settings#profile" className="btn-secondary inline-flex min-h-11 text-body-sm">
              Complete profile
            </Link>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-error/30 bg-error-soft px-space-4 py-space-3 text-body-sm text-error">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border-subtle bg-surface px-space-5 py-space-4">
            <p className="text-body-sm text-text-secondary">Uploads</p>
            <p className="mt-2 font-display text-display-sm font-bold text-text-primary">
              {loading ? '—' : uploads.length}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface px-space-5 py-space-4">
            <p className="text-body-sm text-text-secondary">Courses ready</p>
            <p className="mt-2 font-display text-display-sm font-bold text-text-primary">
              {loading ? '—' : readyCourses}
            </p>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-surface px-space-5 py-space-4">
            <p className="text-body-sm text-text-secondary">Next step</p>
            <p className="mt-2 font-semibold text-text-primary">
              {loading ? '—' : continueCourse ? 'Continue a lesson' : 'Upload your first file'}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-border-subtle bg-surface p-space-6">
            <h2 className="font-display text-display-sm font-bold text-text-primary">Continue learning</h2>
            {loading ? (
              <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-soft" />
            ) : continueCourse ? (
              <>
                <p className="mt-2 text-body-md font-semibold text-text-primary">{continueCourse.title}</p>
                <p className="mt-1 text-body-sm text-text-secondary">
                  {resumeTarget?.title
                    ? `Pick up ${resumeTarget.title}`
                    : 'Open the latest course and keep moving through lessons and quizzes.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to={courseHref(continueCourse)} className="btn-primary inline-flex min-h-11 text-body-sm">
                    Continue lesson
                  </Link>
                  <Link to="/dashboard/quiz" className="btn-secondary inline-flex min-h-11 text-body-sm">
                    Practice quiz
                  </Link>
                  <Link to="/dashboard/ai-tutor" className="btn-secondary inline-flex min-h-11 text-body-sm">
                    Ask AI tutor
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-body-md text-text-secondary">
                  No courses yet. Upload a PDF, deck, or notes file to generate your first lesson set.
                </p>
                <Link to="/dashboard/upload" className="btn-primary mt-5 inline-flex min-h-11 text-body-sm">
                  Upload material
                </Link>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border-subtle bg-surface p-space-6">
            <h2 className="font-display text-display-sm font-bold text-text-primary">Quick actions</h2>
            <ul className="mt-4 space-y-2">
              {[
                { to: '/dashboard/upload', label: 'Upload', icon: 'cloud_upload' },
                { to: '/dashboard/library', label: 'My materials', icon: 'folder' },
                { to: '/dashboard/lessons', label: 'Lessons', icon: 'menu_book' },
                { to: '/dashboard/quiz', label: 'Quizzes', icon: 'quiz' },
                { to: '/dashboard/progress', label: 'Progress', icon: 'bar_chart' },
              ].map((action) => (
                <li key={action.to}>
                  <Link
                    to={action.to}
                    className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-body-sm font-semibold text-text-primary transition-colors hover:bg-surface-soft"
                  >
                    <AppIcon name={action.icon} className="text-[20px] text-primary" aria-hidden="true" />
                    {action.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-display-sm font-bold text-text-primary">Recent uploads</h2>
            <Link to="/dashboard/library" className="text-body-sm font-semibold text-primary hover:text-primary-hover">
              View library
            </Link>
          </div>
          {loading ? (
            <div className="mt-4 h-28 animate-pulse rounded-2xl bg-surface-soft" />
          ) : recentUploads.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-border-default bg-surface px-space-5 py-space-6 text-body-sm text-text-secondary">
              Nothing uploaded yet. Start with a lecture PDF or slide deck.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle bg-surface">
              {recentUploads.map((upload) => (
                <li key={upload.id} className="flex min-h-11 items-center justify-between gap-3 px-space-5 py-space-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">{upload.fileName || 'Untitled upload'}</p>
                    <p className="mt-0.5 text-caption text-text-secondary">{upload.status || 'processing'}</p>
                  </div>
                  <Link
                    to={upload.courseId ? courseHref({ id: upload.courseId }) : '/dashboard/library'}
                    className="shrink-0 text-body-sm font-semibold text-primary"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </div>
  );
};

export default StudentDashboard;
