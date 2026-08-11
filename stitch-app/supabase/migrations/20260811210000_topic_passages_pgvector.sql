-- Topic passage embeddings for tutor RAG (Voyage + pgvector).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS topic_passages (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  upload_id TEXT,
  user_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS topic_passages_by_topic
  ON topic_passages (topic_id);

CREATE INDEX IF NOT EXISTS topic_passages_by_user_topic
  ON topic_passages (user_id, topic_id);

-- Cosine distance ANN index for retrieval.
CREATE INDEX IF NOT EXISTS topic_passages_embedding_hnsw
  ON topic_passages
  USING hnsw (embedding vector_cosine_ops);
