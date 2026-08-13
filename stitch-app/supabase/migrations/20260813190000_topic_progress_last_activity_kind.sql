-- Record whether the latest study activity was a lesson, quiz, or podcast.
ALTER TABLE topic_progress
  ADD COLUMN IF NOT EXISTS last_activity_kind TEXT NOT NULL DEFAULT 'lesson';

UPDATE topic_progress
SET last_activity_kind = 'lesson'
WHERE last_activity_kind IS NULL
   OR last_activity_kind NOT IN ('lesson', 'quiz', 'podcast');

ALTER TABLE topic_progress
  DROP CONSTRAINT IF EXISTS topic_progress_last_activity_kind_check;

ALTER TABLE topic_progress
  ADD CONSTRAINT topic_progress_last_activity_kind_check
  CHECK (last_activity_kind IN ('lesson', 'quiz', 'podcast'));
