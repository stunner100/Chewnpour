-- Heuristic (no-AI) MCQs used other true sentences from the same source as
-- distractors, so a correct pick could be marked wrong. They are no longer
-- generated; remove the ones already stored.
DELETE FROM public.questions
WHERE prompt LIKE 'According to “%”, which statement is accurate?';
