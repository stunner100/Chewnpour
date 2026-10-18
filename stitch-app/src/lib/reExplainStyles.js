// Re-explain styles, shared by the dialog (labels) and the server (the
// instruction sent to the model). The client sends the style id.
export const RE_EXPLAIN_STYLES = [
    { id: 'simple_summary', label: 'Simple summary', instruction: 'Explain each section more simply and briefly, keeping its key points.' },
    { id: 'step_by_step', label: 'Step-by-step', instruction: 'Break each section into clear numbered steps or parts where that fits.' },
    { id: 'analogy', label: 'Story/analogy', instruction: 'Explain each section through a short everyday analogy or story, then state the fact plainly and say where the analogy stops fitting.' },
    { id: 'bullet_points', label: 'Bullet points', instruction: 'Rewrite each section as concise bullet points.' },
    { id: 'short_direct', label: 'Short & direct', instruction: 'Make each section as short and direct as possible without losing any fact.' },
    { id: 'like_12', label: 'Teach me like I’m 12', instruction: 'Explain each section as if to a curious 12-year-old, in short sentences and everyday words.' },
    { id: 'pidgin', label: 'Ghanaian Pidgin', instruction: 'Rewrite each section in Ghanaian Pidgin English, keeping technical terms in standard English.' },
];

export const DEFAULT_RE_EXPLAIN_STYLE = 'like_12';

export const reExplainStyleById = (id) =>
    RE_EXPLAIN_STYLES.find((style) => style.id === id)
    || RE_EXPLAIN_STYLES.find((style) => style.id === DEFAULT_RE_EXPLAIN_STYLE);
