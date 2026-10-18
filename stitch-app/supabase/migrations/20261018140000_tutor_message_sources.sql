-- Tutor answers keep the passages from the student's notes they were
-- grounded in ({passageId, chunkIndex, snippet}), so the chat can show
-- "From your notes" under an answer after a reload too.
ALTER TABLE "topic_chat_messages"
  ADD COLUMN IF NOT EXISTS "sources" JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE "topic_chat_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "topic_chat_messages" FROM anon, authenticated;
