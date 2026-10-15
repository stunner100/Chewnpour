-- exam_attempts and topic_passages were created without RLS or a revoke, so
-- Supabase's default grants gave the anon/authenticated API roles full
-- read/write access through PostgREST. Every app read goes through the API
-- server's own Postgres connection, so these roles need no access at all.
ALTER TABLE "exam_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "exam_attempts" FROM anon, authenticated;

ALTER TABLE "topic_passages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "topic_passages" FROM anon, authenticated;

-- Stop future migrations (run as postgres) from silently re-exposing new
-- tables, sequences, and functions in public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
