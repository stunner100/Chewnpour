// Reads lesson markdown as a syntax tree (the same parser the renderer uses)
// instead of rewriting it with line regexes.
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const parser = unified().use(remarkParse).use(remarkGfm);

export const parseLessonMarkdown = (markdown) => parser.parse(String(markdown || ''));

const BLOCK_CONTAINERS = new Set(['root', 'list', 'listItem', 'blockquote', 'table', 'tableRow']);

// Plain text of a node. Block containers put a space between their children so
// list items and table cells do not run together.
const nodeText = (node, { skipCode = false } = {}) => {
    if (!node) return '';
    if (node.type === 'code') return skipCode ? '' : node.value || '';
    if (node.type === 'html') return '';
    if (node.type === 'text' || node.type === 'inlineCode') return node.value || '';
    if (node.type === 'break') return ' ';
    if (node.type === 'image') return node.alt || '';
    const children = Array.isArray(node.children) ? node.children : [];
    const separator = BLOCK_CONTAINERS.has(node.type) ? ' ' : '';
    return children.map((child) => nodeText(child, { skipCode })).join(separator);
};

const collapse = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// Text for read-aloud: code blocks are skipped, everything else is read as
// written (minus signs and hyphens included).
export const markdownToSpeechText = (markdown) =>
    collapse(parseLessonMarkdown(markdown).children.map((node) => nodeText(node, { skipCode: true })).join(' '));

export const markdownWordCount = (markdown) => {
    const text = collapse(nodeText(parseLessonMarkdown(markdown)));
    return text ? text.split(' ').length : 0;
};
