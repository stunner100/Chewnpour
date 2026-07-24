-- Topic tutor chat messages (greenfield cutover from Convex topicChatMessages)
CREATE TABLE IF NOT EXISTS "topic_chat_messages" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "topic_id" TEXT NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "topic_chat_messages_by_user_topic_created"
  ON "topic_chat_messages" ("user_id", "topic_id", "created_at" ASC);

ALTER TABLE "topic_chat_messages" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "topic_chat_messages" FROM anon, authenticated;
