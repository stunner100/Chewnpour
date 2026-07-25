import { Navigate } from 'react-router-dom';

/** Parked after Convex → Supabase hard cutover. */
export default function ParkedConvexRoute() {
  return <Navigate to="/dashboard" replace />;
}
