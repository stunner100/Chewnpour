import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

const DashboardSearch = () => {
    const { user } = useAuth();
    const userId = user?.id;
    const [searchParams, setSearchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [localQuery, setLocalQuery] = React.useState(query);

    React.useEffect(() => {
        setLocalQuery(query);
    }, [query]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (localQuery.trim()) {
                setSearchParams({ q: localQuery.trim() });
            } else {
                setSearchParams({});
            }
        }
    };

    const courses = useQuery(api.courses.getUserCourses, userId ? { userId } : 'skip');

    const gradients = [
        'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
        'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
    ];

    const normalizedQuery = query.trim().toLowerCase();

    const matchingCourses = useMemo(() => {
        if (!courses || !normalizedQuery) return [];
        return courses.filter((course) => {
            const title = course.title?.toLowerCase() || '';
            const description = course.description?.toLowerCase() || '';
            return title.includes(normalizedQuery) || description.includes(normalizedQuery);
        });
    }, [courses, normalizedQuery]);

    return (
        <div className="bg-background-light dark:bg-background-dark font-body antialiased min-h-screen flex flex-col transition-colors duration-300">
            <header className="sticky top-0 z-50 w-full glass border-b border-neutral-200/50 dark:border-neutral-800/50">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-4 md:gap-8">
                    <div className="flex items-center gap-3 shrink-0">
                        <Link to="/dashboard" aria-label="Go back to dashboard" className="w-10 h-10 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-500 transition-colors">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </Link>
                        <div className="w-10 h-10 bg-gradient-to-br from-primary via-purple-500 to-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                            <span className="material-symbols-outlined text-[24px]">search</span>
                        </div>
                        <span className="text-xl font-display font-bold tracking-tight text-neutral-900 dark:text-white hidden sm:block">Search Results</span>
                    </div>
                    <div className="flex-1 max-w-xl">
                        <div className="relative group transition-transform duration-300 focus-within:scale-[1.01]">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors material-symbols-outlined">search</span>
                            <input
                                className="w-full pl-12 pr-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:border-primary/30 rounded-2xl focus:ring-4 focus:ring-primary/5 transition-colors text-sm font-medium placeholder-neutral-400"
                                placeholder="Search courses or topics..."
                                type="text"
                                value={localQuery}
                                onChange={(e) => setLocalQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 pb-20 md:px-6 md:py-12 md:pb-12">
                <div className="mb-8">
                    <h1 className="text-3xl lg:text-4xl font-display font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2">
                        {query ? (
                            <>Results for "<span className="text-primary">{query}</span>"</>
                        ) : (
                            "Search Courses"
                        )}
                    </h1>
                    {query && courses && (
                        <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                            Found {matchingCourses.length} matching {matchingCourses.length === 1 ? 'course' : 'courses'}
                        </p>
                    )}
                </div>

                {!courses ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="animate-pulse bg-white dark:bg-neutral-900 rounded-3xl h-[280px] border border-neutral-200 dark:border-neutral-800"></div>
                        ))}
                    </div>
                ) : matchingCourses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {matchingCourses.map((course, idx) => {
                            const gradient = course.coverColor || gradients[idx % gradients.length];
                            return (
                                <Link
                                    key={course._id}
                                    to={`/dashboard/course/${course._id}`}
                                    className="group relative flex flex-col bg-white dark:bg-neutral-900 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-neutral-200/60 dark:border-neutral-800 hover:-translate-y-1"
                                >
                                    <div
                                        className="h-32 w-full relative overflow-hidden"
                                        style={{ background: gradient }}
                                    >
                                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300"></div>
                                        <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                    </div>
                                    <div className="flex flex-col flex-1 p-5 sm:p-6 bg-white dark:bg-neutral-900">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                                                <span className="material-symbols-outlined text-[14px]">local_library</span>
                                                Course
                                            </span>
                                            <span className="text-xs font-medium text-neutral-400 flex items-center gap-1">
                                                {Math.round(course.progress || 0)}%
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-display font-bold text-neutral-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                                            {course.title}
                                        </h3>
                                        <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-4">
                                            {course.description || 'No description available'}
                                        </p>
                                        <div className="mt-auto w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${Math.max(5, course.progress || 0)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : query ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-[40px] text-neutral-400 font-light">search_off</span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-neutral-900 dark:text-white mb-2">
                            No matching courses found
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                            We couldn't find any courses matching "{query}". Try checking for typos or using different keywords.
                        </p>
                        <Link
                            to="/dashboard"
                            className="mt-8 px-6 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold rounded-xl transition-colors"
                        >
                            Return to Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-[40px] text-primary">search</span>
                        </div>
                        <h3 className="text-xl font-display font-bold text-neutral-900 dark:text-white mb-2">
                            Enter a search query
                        </h3>
                        <p className="text-neutral-500 dark:text-neutral-400 max-w-md">
                            Search for courses by title or description using the search bar above.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardSearch;
