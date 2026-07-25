import { Link } from 'react-router-dom';
import AppIcon from './AppIcon';

/**
 * Honest empty state for features paused after the Supabase cutover.
 * Prefer this over silent redirects to /dashboard.
 */
export default function ParkedFeatureView({
  title = 'This feature is paused',
  description = 'We parked this surface during the backend cutover so the live study loop stays reliable. Lessons, quizzes, uploads, tutor chat, and progress are available now.',
  primaryHref = '/dashboard',
  primaryLabel = 'Back to dashboard',
}) {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-space-6 py-space-10">
      <section className="mx-auto w-full max-w-lg text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <AppIcon name="construction" className="text-[28px]" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-display text-display-sm font-bold text-text-primary">{title}</h1>
        <p className="mt-3 text-body-md text-text-secondary">{description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to={primaryHref} className="btn-primary inline-flex min-h-11">
            {primaryLabel}
          </Link>
          <Link to="/dashboard/upload" className="btn-secondary inline-flex min-h-11">
            Upload material
          </Link>
          <Link to="/dashboard/quiz" className="btn-secondary inline-flex min-h-11">
            Practice quiz
          </Link>
        </div>
      </section>
    </div>
  );
}
