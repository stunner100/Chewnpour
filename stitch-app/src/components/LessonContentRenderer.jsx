import React, { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Renders one lesson section's markdown body. The step title is the page's
// h2, so headings inside the body render one level down (h3, then h4).
// Raw HTML is never rendered, images show their alt text, and links must be
// http(s).
const SAFE_LINK_RE = /^https?:\/\//i;

const SubHeading = ({ node: _node, ...props }) => <h3 {...props} />;
const MinorHeading = ({ node: _node, ...props }) => <h4 {...props} />;

const components = {
    h1: SubHeading,
    h2: SubHeading,
    h3: SubHeading,
    h4: MinorHeading,
    h5: MinorHeading,
    h6: MinorHeading,
    a: ({ node: _node, href, children, ...props }) => (
        SAFE_LINK_RE.test(String(href || ''))
            ? <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            : <span>{children}</span>
    ),
    img: ({ alt }) => (alt ? <span>{alt}</span> : null),
    table: ({ node: _node, ...props }) => (
        <div className="lesson-table-scroll">
            <table {...props} />
        </div>
    ),
    input: () => null,
};

const LessonContentRenderer = memo(function LessonContentRenderer({ markdown }) {
    return (
        <div className="lesson-markdown">
            <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
                {markdown}
            </Markdown>
        </div>
    );
});

export default LessonContentRenderer;
