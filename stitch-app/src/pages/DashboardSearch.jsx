import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const RESULT_GROUPS = [
    { key: 'courses', label: 'Courses', icon: 'local_library', badge: 'Course' },
    { key: 'topics', label: 'Topics', icon: 'menu_book', badge: 'Topic' },
    { key: 'notes', label: 'Notes', icon: 'sticky_note_2', badge: 'Note' },
];

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getHighlightPattern = (query) => {
    const tokens = Array.from(
        new Set(
            String(query || '')
                .trim()
                .split(/[^a-zA-Z0-9]+/)
                .map((token) => token.trim())
                .filter((token) => token.length >= 2)
        )
    );
    if (tokens.length === 0) return null;
    return new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'ig');
};

const renderHighlightedText = (text, query) => {
    const safeText = String(text || '');
    const pattern = getHighlightPattern(query);
    if (!pattern) return safeText;

    return safeText.split(pattern).map((part, index) => {
        if (!part) return null;
        return index % 2 === 1
            ? (
                <mark
                    key={`${part}-${index}`}
                    className="bg-primary/15 text-primary px-0.5 rounded-sm"
                >
                    {part}
                </mark>
            )
            : <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
};

const DashboardSearch = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [localQuery, setLocalQuery] = React.useState(query);

    React.useEffect(() => {
        setLocalQuery(query);
    }, [query]);

    React.useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const trimmed = localQuery.trim();
            if (trimmed === normalizedQuery) return;
            if (trimmed) {
                setSearchParams({ q: trimmed }, { replace: true });
                return;
            }
            setSearchParams({}, { replace: true });
        }, 250);

        return () => window.clearTimeout(timeoutId);
    }, [localQuery, normalizedQuery, setSearchParams]);

    const normalizedQuery = query.trim();
    const searchResults = useQuery(
        api.search.searchDashboardContent,
        normalizedQuery ? { query: normalizedQuery, limit: 8 } : 'skip'
    );

    const groupedResults = RESULT_GROUPS.map((group) => ({
        ...group,
        items: Array.isArray(searchResults?.[group.key]) ? searchResults[group.key] : [],
    }));

    const handleSearchKeyDown = (event) => {
        if (event.key !== 'Enter') return;

        const trimmed = localQuery.trim();
        if (trimmed) {
            setSearchParams({ q: trimmed });
            return;
        }
        setSearchParams({});
    };

    const totalCount = Number(searchResults?.totalCount || 0);
    const hasAnyResults = groupedResults.some((group) => group.items.length > 0);

    return (
        <div className="w-full max-w-4xl mx-auto px-4 md:px-8 py-8 pb-24 md:pb-12">
            {/* Search input */}
            <div className="mb-8">
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-text-faint-light dark:text-text-faint-dark text-[20px]">
                        search
                    </span>
                    <input
                        className="input-lg pl-12 pr-4"
                        placeholder="Search courses, topics, or notes..."
                        type="text"
                        value={localQuery}
                        onChange={(event) => setLocalQuery(event.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        autoFocus
                    />
                </div>
            </div>

            {/* Results header */}
            {normalizedQuery && (
                <div className="mb-6">
                    <h1 className="text-display-sm text-text-main-light dark:text-text-main-dark">
                        Results for &ldquo;{normalizedQuery}&rdquo;
                    </h1>
                    {searchResults && (
                        <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark mt-1">
                            {totalCount} result{totalCount === 1 ? '' : 's'} found
                        </p>
                    )}
                </div>
            )}

            {/* Empty / no query state */}
            {!normalizedQuery ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mb-5">
                        <span className="material-symbols-outlined text-[28px] text-text-faint-light dark:text-text-faint-dark">search</span>
                    </div>
                    <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                        Search your study space
                    </h3>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-sm">
                        Start typing to search courses, topics, and notes across all your materials.
                    </p>
                </div>

            ) : !searchResults ? (
                /* Loading skeleton */
                <div className="space-y-8">
                    {RESULT_GROUPS.map((group) => (
                        <section key={group.key}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">{group.icon}</span>
                                <h2 className="text-body-sm font-semibold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider">
                                    {group.label}
                                </h2>
                            </div>
                            <div className="space-y-2">
                                {[1, 2].map((i) => (
                                    <div key={`${group.key}-${i}`} className="animate-pulse h-20 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark" />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>

            ) : hasAnyResults ? (
                /* Results list */
                <div className="space-y-8">
                    {groupedResults.map((group) => (
                        <section key={group.key}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark">{group.icon}</span>
                                    <h2 className="text-body-sm font-semibold text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider">
                                        {group.label}
                                    </h2>
                                </div>
                                <span className="text-caption text-text-faint-light dark:text-text-faint-dark">
                                    {group.items.length}
                                </span>
                            </div>

                            {group.items.length > 0 ? (
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <Link
                                            key={`${group.key}-${item.entityId}`}
                                            to={item.path}
                                            className="group flex items-start gap-4 p-4 rounded-xl hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors"
                                        >
                                            <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/8 dark:bg-primary/15 flex items-center justify-center mt-0.5">
                                                <span className="material-symbols-outlined text-[18px] text-primary">{group.icon}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark group-hover:text-primary transition-colors truncate">
                                                        {renderHighlightedText(item.title, normalizedQuery)}
                                                    </h3>
                                                    <span className="shrink-0 text-caption text-text-faint-light dark:text-text-faint-dark">
                                                        {new Date(item.updatedAt || Date.now()).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark line-clamp-2">
                                                    {renderHighlightedText(item.snippet, normalizedQuery)}
                                                </p>
                                            </div>
                                            <span className="material-symbols-outlined text-[18px] text-text-faint-light dark:text-text-faint-dark opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                                arrow_forward
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-border-light dark:border-border-dark px-5 py-6 text-body-sm text-text-faint-light dark:text-text-faint-dark text-center">
                                    No matching {group.label.toLowerCase()}.
                                </div>
                            )}
                        </section>
                    ))}
                </div>

            ) : (
                /* No results */
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center mb-5">
                        <span className="material-symbols-outlined text-[28px] text-text-faint-light dark:text-text-faint-dark">search_off</span>
                    </div>
                    <h3 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark mb-1">
                        No results found
                    </h3>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark max-w-sm">
                        Nothing matched &ldquo;{normalizedQuery}&rdquo;. Try a different keyword.
                    </p>
                    <Link
                        to="/dashboard"
                        className="mt-6 btn-secondary text-body-sm px-5 py-2"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            )}
        </div>
    );
};

export default DashboardSearch;
