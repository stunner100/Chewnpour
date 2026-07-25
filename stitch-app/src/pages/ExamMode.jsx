import ParkedFeatureView from '../components/ParkedFeatureView';

/** Parked after Convex → Supabase hard cutover — show an honest pause state. */
export default function ParkedConvexRoute() {
  return (
    <ParkedFeatureView
      title="Exam mode"
      description="This surface is paused while we keep the live study loop stable. Uploads, lessons, quizzes, AI tutor, and progress are available now."
    />
  );
}
