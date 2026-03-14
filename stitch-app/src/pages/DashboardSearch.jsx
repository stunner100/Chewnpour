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
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col transition-colors duration-300">
            <header className="sticky top-0 z-50 w-full glass border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4 md:gap-8">
                    <div className="flex items-center gap-3 shrink-0">
                        <Link
                            to="/dashboard"
                            aria-label="Go back to dashboard"
                            className="w-10 h-10 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-500 transition-colors"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </Link>
                        <div className="w-10 h-10 bg-gradient-to-br from-primary via-purple-500 to-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-[24px]">search</span>
                        </div>
                        <span className="text-xl font-display font-bold tracking-tight text-neutral-900 dark:text-white hidden sm:block">
                            Search Results
                        </span>
                    </div>
                    <div className="flex-1 max-w-xl">
                        <div className="relative group transition-transform duration-300 focus-within:scale-[1.01]">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors material-symbols-outlined">
                                search
                            </span>
                            <input
                                className="w-full pl-12 pr-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-primary/30 rounded-2xl focus:ring-4 focus:ring-primary/5 transition-colors text-sm font-medium placeholder-neutral-400"
                                placeholder="Search courses, topics, or notes..."
                                type="text"
                                value={localQuery}
                                onChange={(event) => setLocalQuery(event.target.value)}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 pb-20 md:px-6 md:py-12 md:pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
                        {normalizedQuery ? (
                            <>Results for "<span className="text-primary">{normalizedQuery}</span>"</>
                        ) : (
                            'Search Your Study Space'
                        )}
                    </h1>
                    {normalizedQuery && searchResults && (
                        <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                            Found {totalCount} matching result{totalCount === 1 ? '' : 's'} across courses, topics, and notes
                        </p>
                    )}
                </div>

                {!normalizedQuery ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-[40px] text-primary">search</span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-neutral-900 dark:text-white mb-2">
                            Enter a search query
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                            Search across your courses, generated topics, and saved notes from one place.
                        </p>
                    </div>
                ) : !searchResults ? (
                    <div className="space-y-10">
                        {RESULT_GROUPS.map((group) => (
                            <section key={group.key}>
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="material-symbols-outlined text-primary">{group.icon}</span>
                                    <h2 className="text-2xl font-display font-bold text-neutral-900 dark:text-white">
                                        {group.label}
                                    </h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                    {[1, 2].map((index) => (
                                        <div
                                            key={`${group.key}-${index}`}
                                            className="animate-pulse h-40 rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                                        />
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                ) : hasAnyResults ? (
                    <div className="space-y-10">
                        {groupedResults.map((group) => (
                            <section key={group.key}>
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">{group.icon}</span>
                                        <h2 className="text-2xl font-display font-bold text-neutral-900 dark:text-white">
                                            {group.label}
                                        </h2>
                                    </div>
                                    <span className="text-sm font-semibold text-neutral-400">
                                        {group.items.length}
                                    </span>
                                </div>

                                {group.items.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                                        {group.items.map((item) => (
                                            <Link
                                                key={`${group.key}-${item.entityId}`}
                                                to={item.path}
                                                className="group rounded-3xl border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                                            >
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {group.icon}
                                                        </span>
                                                        {group.badge}
                                                    </span>
                                                    <span className="text-xs text-neutral-400 font-medium">
                                                        {new Date(item.updatedAt || Date.now()).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <h3 className="text-lg font-display font-bold text-neutral-900 dark:text-white mb-2 group-hover:text-primary transition-colors line-clamp-2">
                                                    {renderHighlightedText(item.title, normalizedQuery)}
                                                </h3>
                                                <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-4">
                                                    {renderHighlightedText(item.snippet, normalizedQuery)}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 px-6 py-8 text-sm text-neutral-500 dark:text-neutral-400">
                                        No matching {group.label.toLowerCase()} for this query.
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-[40px] text-neutral-400 font-light">
                                search_off
                            </span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-neutral-900 dark:text-white mb-2">
                            No matching results found
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                            We could not find courses, topics, or notes matching "{normalizedQuery}". Try a broader keyword.
                        </p>
                        <Link
                            to="/dashboard"
                            className="mt-8 px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold rounded-xl transition-colors"
                        >
                            Return to Dashboard
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardSearch;
