import React, { memo } from 'react';

const TopicSidebar = memo(function TopicSidebar({
    normalizedContent,
    contentLines,
    toc,
    cleanLine,
    topic,
}) {
    return (
        <div className="lg:col-span-3 space-y-6">
            <div className="sticky top-28 space-y-6">
                <div className="glass-card rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative group">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/10">
                            <span className="material-symbols-outlined text-[20px]">analytics</span>
                        </div>
                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">Lesson Stats</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <div className="text-2xl font-black text-slate-800 dark:text-white mb-1">
                                {normalizedContent ? Math.ceil(normalizedContent.split(/\s+/).length / 200) : 1}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Minutes</div>
                        </div>
                        <div className="bg-slate-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                            <div className="text-2xl font-black text-slate-800 dark:text-white mb-1">
                                {normalizedContent ? normalizedContent.split(/\s+/).length : 0}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Words</div>
                        </div>
                    </div>
                </div>

                {normalizedContent && toc.length > 0 && (
                    <div className="glass-card rounded-[2.5rem] p-8 border border-slate-200/50 dark:border-slate-700/50 hidden lg:block relative overflow-hidden group">
                        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
                        <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                            </div>
                            Table of Contents
                        </h3>
                        <nav className="space-y-3 relative z-10">
                            {toc.map((item) => (
                                <a
                                    key={item.id}
                                    href={`#${item.id}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const el = document.getElementById(item.id);
                                        if (!el) return;
                                        const offset = 120;
                                        const top = el.getBoundingClientRect().top + window.scrollY - offset;
                                        window.scrollTo({ top, behavior: 'smooth' });
                                    }}
                                    className={`group/item flex items-center gap-3 py-1 text-sm transition-colors hover:translate-x-1 ${item.level === 1 ? 'font-black text-slate-800 dark:text-slate-200' :
                                        item.level === 2 ? 'pl-4 font-bold text-slate-500 dark:text-slate-400' :
                                            'pl-8 text-slate-400 dark:text-slate-500'
                                        }`}
                                >
                                    <span className={`w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover/item:bg-primary transition-colors ${item.level === 1 ? 'w-2 h-2' : ''}`}></span>
                                    {item.text}
                                </a>
                            ))}
                        </nav>
                    </div>
                )}

                <div className="bg-gradient-to-br from-indigo-500 to-primary rounded-[2.5rem] p-8 text-white shadow-xl shadow-primary/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 transform scale-150 rotate-12 group-hover:rotate-45 transition-transform duration-700">
                        <span className="material-symbols-outlined text-8xl">bolt</span>
                    </div>
                    <h3 className="font-black text-[10px] uppercase tracking-[0.3em] opacity-70 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        Lesson Snapshot
                    </h3>
                    <ul className="space-y-4 relative z-10">
                        {(contentLines && contentLines.length > 0 ? contentLines : [
                            cleanLine(topic?.description || 'Lesson summary loading...')
                        ]).slice(0, 3).map((line, idx) => {
                            if (!line || typeof line !== 'string') return null;
                            const summaryLine = cleanLine(line);
                            if (!summaryLine) return null;
                            return (
                                <li key={idx} className="flex items-start gap-4">
                                    <div className="mt-1.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/10 group-hover:bg-white/30 transition-colors">
                                        <span className="material-symbols-outlined text-[12px]">done_all</span>
                                    </div>
                                    <span className="text-xs font-bold text-white/90 leading-relaxed line-clamp-2 uppercase tracking-wide">{summaryLine}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </div>
    );
});

export default TopicSidebar;
