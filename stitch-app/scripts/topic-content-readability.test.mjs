import assert from 'node:assert/strict';
import {
    cleanDisplayLine,
    isArtifactLine,
    normalizeLessonContent,
} from '../src/lib/topicContentFormatting.js';

const tests = [
    () => {
        const raw = 'Present Documents : Make documents available. \\ Example 2: Automated Information Gathering \\ Steps : \\.';
        const normalized = normalizeLessonContent(raw);
        assert.equal(normalized.includes('\\'), false, 'Expected stray backslashes to be removed');
    },
    () => {
        const raw = 'Topic 1: Intro to AIR\\nThe Collection Component of an AIR Dr.\\n\\nMrs.\\n\\nFlorence O.\\n\\nIn this lesson, we explore retrieval.';
        const normalized = normalizeLessonContent(raw);
        assert.equal(normalized.includes('\nMrs.'), false, 'Expected isolated honorific line to be dropped');
        assert.equal(normalized.includes('In this lesson, we explore retrieval.'), true, 'Expected core sentence to remain');
    },
    () => {
        const raw = 'This is context. Simple Introduction We start here.';
        const normalized = normalizeLessonContent(raw);
        assert.equal(normalized.includes('### Simple Introduction'), true, 'Expected inline section title to become heading');
    },
    () => {
        const cleaned = cleanDisplayLine('**Key Term** : \\[retrieval\\] system');
        assert.equal(cleaned, 'Key Term : retrieval system');
    },
    () => {
        const raw = '-\n\n**Extremism** : When beliefs go too far.\n\n>\n\n-\n\n**Critical Thinking** : Evaluate ideas carefully.\n\n>';
        const normalized = normalizeLessonContent(raw);
        const normalizedLines = normalized.split('\n').map((line) => line.trim());
        assert.equal(normalizedLines.includes('-'), false, 'Expected standalone dash markers to be removed');
        assert.equal(normalizedLines.includes('>'), false, 'Expected standalone blockquote markers to be removed');
        assert.equal(normalized.includes('**Extremism** : When beliefs go too far.'), true, 'Expected definition content to remain');
        assert.equal(normalized.includes('**Critical Thinking** : Evaluate ideas carefully.'), true, 'Expected second definition content to remain');
    },
    () => {
        const raw = '**Extremism**: Strong views.\\n> -\\n\\n**Critical Thinking**: Careful evaluation.';
        const normalized = normalizeLessonContent(raw);
        assert.equal(normalized.includes('> -'), false, 'Expected blockquote marker artifacts to be removed');
        assert.equal(normalized.includes('**Critical Thinking**: Careful evaluation.'), true, 'Expected meaningful content to remain');
    },
    () => {
        const cleaned = cleanDisplayLine('*Simple* [example] _text_ with **markers**');
        assert.equal(cleaned.includes('*'), false, 'Expected single asterisk emphasis markers to be removed');
        assert.equal(cleaned.includes('_'), false, 'Expected underscore emphasis markers to be removed');
        assert.equal(cleaned, 'Simple example text with markers');
    },
    () => {
        assert.equal(isArtifactLine('> -'), true, 'Expected ">" and "-" artifact line to be detected');
        assert.equal(isArtifactLine('\\\\'), true, 'Expected standalone slash artifact to be detected');
        assert.equal(isArtifactLine('Key Idea: Practice daily'), false, 'Expected real content line to remain');
    },
];

for (const run of tests) {
    run();
}

console.log('topic-content-readability tests passed');
