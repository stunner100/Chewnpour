-- topics.lesson replaces topics.content (hard cutover).
--
-- A lesson is { hook, sections: [{ title, role, body }], recap, wordBank }.
-- Existing markdown lessons are converted with the same rules as
-- lessonFromMarkdown in src/lib/lessonSchema.js (checked by
-- scripts/topic-lesson-migration-parity.mjs), and in-lesson checks move from
-- payload.sectionTitle to payload.sectionIndex. A check whose section no longer
-- exists is deleted; the lesson page already hid those.

ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "lesson" JSONB;

-- BEGIN lesson converter
CREATE OR REPLACE FUNCTION public.chewnpour_markdown_to_lesson(md TEXT, topic_title TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
    v TEXT := coalesce(md, '');
    line TEXT;
    m TEXT[];
    fence TEXT := NULL;
    cur_title TEXT := 'Introduction';
    cur_level INT := 0;
    cur_lines TEXT[] := '{}';
    raw_titles TEXT[] := '{}';
    raw_levels INT[] := '{}';
    raw_bodies TEXT[] := '{}';
    body TEXT;
    i INT;
    sec_title TEXT;
    sec_key TEXT;
    title_key TEXT;
    item TEXT;
    term TEXT;
    definition TEXT;
    terms JSONB;
    sections JSONB := '[]'::JSONB;
    word_bank JSONB := '[]'::JSONB;
    role TEXT;
    repeats BOOLEAN;
BEGIN
    -- normalizeLessonContent
    v := replace(v, chr(160), ' ');
    v := regexp_replace(v, '[​-‍﻿]', '', 'g');
    v := regexp_replace(v, E'\r\n?', E'\n', 'g');
    v := regexp_replace(v, '\\r\\n(?![a-z])', E'\n', 'g');
    v := regexp_replace(v, '\\n(?![a-z])', E'\n', 'g');
    v := regexp_replace(v, '\\t(?![a-z])', '    ', 'g');
    v := replace(v, '\"', '"');
    v := regexp_replace(v, E'[ \t]+$', '', 'gn');
    v := regexp_replace(v, E'\n{3,}', E'\n\n', 'g');
    v := btrim(v, E' \t\n\r');

    -- splitMarkdownIntoSections: H1/H2 outside code fences
    FOREACH line IN ARRAY string_to_array(v, E'\n') LOOP
        m := regexp_match(line, '^\s{0,3}(`{3,}|~{3,})');
        IF m IS NOT NULL THEN
            IF fence IS NULL THEN
                fence := m[1];
            ELSIF left(m[1], 1) = left(fence, 1) AND length(m[1]) >= length(fence) THEN
                fence := NULL;
            END IF;
            cur_lines := cur_lines || line;
            CONTINUE;
        END IF;
        m := CASE WHEN fence IS NULL THEN regexp_match(line, '^\s{0,3}(#{1,2})\s+(.+)$') END;
        IF m IS NOT NULL THEN
            body := btrim(array_to_string(cur_lines, E'\n'), E' \t\n\r');
            IF body <> '' THEN
                raw_titles := raw_titles || cur_title;
                raw_levels := raw_levels || cur_level;
                raw_bodies := raw_bodies || body;
            END IF;
            cur_title := btrim(regexp_replace(m[2], '\s+#+\s*$', ''), E' \t');
            cur_level := length(m[1]);
            cur_lines := '{}';
            CONTINUE;
        END IF;
        cur_lines := cur_lines || line;
    END LOOP;
    body := btrim(array_to_string(cur_lines, E'\n'), E' \t\n\r');
    IF body <> '' THEN
        raw_titles := raw_titles || cur_title;
        raw_levels := raw_levels || cur_level;
        raw_bodies := raw_bodies || body;
    END IF;

    -- lessonFromMarkdown
    title_key := btrim(regexp_replace(lower(coalesce(topic_title, '')), '[^a-z0-9]+', ' ', 'g'));
    FOR i IN 1 .. coalesce(array_length(raw_titles, 1), 0) LOOP
        sec_title := raw_titles[i];
        sec_key := btrim(regexp_replace(lower(sec_title), '[^a-z0-9]+', ' ', 'g'));
        CONTINUE WHEN sec_key IN ('quick check', 'self check', 'self check prompts', 'review questions');

        IF sec_key IN ('word bank', 'quick glossary', 'glossary') THEN
            terms := '[]'::JSONB;
            FOREACH line IN ARRAY string_to_array(raw_bodies[i], E'\n') LOOP
                item := btrim((regexp_match(line, '^\s*[-*+]\s+(.+)$'))[1], E' \t');
                CONTINUE WHEN item IS NULL OR item = '';
                term := NULL;
                definition := NULL;
                m := regexp_match(item, '^\*\*(.+?)\*\*\s*(.*)$');
                IF m IS NOT NULL THEN
                    term := btrim(regexp_replace(m[1], '[:\s]+$', ''), E' \t');
                    definition := btrim(regexp_replace(m[2], '^[:—–-]\s*', ''), E' \t');
                ELSE
                    m := regexp_match(item, '^(.{1,80}?)\s*(?::|\s—\s|\s–\s|\s-\s)\s*(.+)$');
                    IF m IS NOT NULL THEN
                        term := btrim(m[1], E' \t');
                        definition := btrim(m[2], E' \t');
                    END IF;
                END IF;
                IF coalesce(term, '') <> '' AND coalesce(definition, '') <> '' THEN
                    terms := terms || jsonb_build_array(jsonb_build_object('term', term, 'definition', definition));
                END IF;
            END LOOP;
            IF jsonb_array_length(terms) > 0 THEN
                word_bank := word_bank || terms;
                CONTINUE;
            END IF;
        END IF;

        repeats := title_key <> '' AND raw_levels[i] = 1 AND sec_key = title_key;
        IF repeats AND jsonb_array_length(sections) = 1 AND sections -> 0 ->> 'title' = 'Introduction' THEN
            sections := jsonb_set(
                sections,
                '{0,body}',
                to_jsonb((sections -> 0 ->> 'body') || E'\n\n' || raw_bodies[i])
            );
            CONTINUE;
        END IF;
        IF repeats THEN
            sec_title := 'Introduction';
            sec_key := 'introduction';
        END IF;
        role := CASE sec_key
            WHEN 'the steps' THEN 'steps'
            WHEN 'step by step breakdown' THEN 'steps'
            WHEN 'worked example' THEN 'example'
            WHEN 'worked examples' THEN 'example'
            WHEN 'examples and non examples' THEN 'example'
            WHEN 'a sourced episode' THEN 'example'
            WHEN 'traps and mistakes' THEN 'misconception'
            WHEN 'the attractive wrong idea' THEN 'misconception'
            WHEN 'common mistakes' THEN 'misconception'
            WHEN 'common mistakes and misconceptions' THEN 'misconception'
            WHEN 'use it' THEN 'practice'
            ELSE 'core'
        END;
        sections := sections || jsonb_build_array(
            jsonb_build_object('title', sec_title, 'role', role, 'body', raw_bodies[i])
        );
    END LOOP;

    IF jsonb_array_length(sections) > 0
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(sections) s WHERE s ->> 'role' = 'core') THEN
        sections := jsonb_set(sections, '{0,role}', '"core"'::JSONB);
    END IF;

    RETURN jsonb_build_object('hook', '', 'sections', sections, 'recap', '[]'::JSONB, 'wordBank', word_bank);
END;
$fn$;
-- END lesson converter

UPDATE "topics"
SET "lesson" = public.chewnpour_markdown_to_lesson("content", "title")
WHERE "lesson" IS NULL;

-- In-lesson checks bind to a section by index.
UPDATE "questions" q
SET "payload" = (coalesce(q."payload", '{}'::JSONB) - 'sectionTitle')
    || jsonb_build_object('sectionIndex', bound.section_index)
FROM (
    SELECT DISTINCT ON (q2."id") q2."id", (s.ordinality - 1)::INT AS section_index
    FROM "questions" q2
    JOIN "topics" t ON t."id" = q2."topic_id"
    CROSS JOIN LATERAL jsonb_array_elements(t."lesson" -> 'sections') WITH ORDINALITY AS s(section, ordinality)
    WHERE coalesce(q2."surface", 'quiz') = 'in_lesson'
      AND btrim(regexp_replace(lower(s.section ->> 'title'), '[^a-z0-9]+', ' ', 'g'))
          = btrim(regexp_replace(lower(coalesce(q2."payload" ->> 'sectionTitle', '')), '[^a-z0-9]+', ' ', 'g'))
    ORDER BY q2."id", s.ordinality
) bound
WHERE q."id" = bound."id";

DELETE FROM "questions"
WHERE coalesce("surface", 'quiz') = 'in_lesson'
  AND NOT (coalesce("payload", '{}'::JSONB) ? 'sectionIndex');

DROP FUNCTION public.chewnpour_markdown_to_lesson(TEXT, TEXT);

ALTER TABLE "topics" ALTER COLUMN "lesson" SET NOT NULL;
ALTER TABLE "topics" DROP COLUMN "content";
