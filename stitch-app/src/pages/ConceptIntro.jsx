import { Navigate } from 'react-router-dom';

/** Parked after Convex → Supabase hard cutover. */
export default function ConceptIntro() {
  return <Navigate to="/dashboard/progress" replace />;
}
