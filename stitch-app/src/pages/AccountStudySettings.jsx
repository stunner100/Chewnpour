import React, { useState } from 'react';

const AccountStudySettings = () => {
    const [dailyGoal, setDailyGoal] = useState(120);
    const [sessionLength, setSessionLength] = useState('45');
    const [aiTone, setAiTone] = useState('socratic');
    const [notifications, setNotifications] = useState({
        dailyReminders: true,
        processingAlerts: true,
        weeklyReport: false,
    });

    return (
        <div className="ml-0 md:ml-0 min-h-[calc(100vh-64px)]">
            <div className="max-w-[1000px] mx-auto p-space-6 md:p-space-10 lg:p-space-12 pb-32">
                <div className="flex items-center justify-between mb-space-8">
                    <div>
                        <h2 className="font-display-lg text-display-lg text-text-primary">Settings</h2>
                        <p className="font-body-base text-body-base text-text-muted mt-space-1">Manage your workspace preferences and profile.</p>
                    </div>
                </div>

                {/* Settings Bento Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-6">
                    {/* Left Column (Profile & Account) */}
                    <div className="lg:col-span-5 flex flex-col gap-space-6">
                        {/* Profile Section */}
                        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <span className="material-symbols-outlined text-text-muted">person</span>
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Profile</h3>
                            </div>
                            <div className="flex items-center gap-space-6">
                                <div className="relative group">
                                    <div className="w-20 h-20 rounded-full bg-surface-muted overflow-hidden border-2 border-surface shadow-sm flex items-center justify-center text-2xl font-bold text-text-muted">
                                        AR
                                    </div>
                                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-surface border border-border-subtle rounded-full flex items-center justify-center text-text-secondary hover:text-primary shadow-sm group-hover:scale-105 transition-transform" type="button">
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                </div>
                                <div className="flex-1">
                                    <label className="block font-label-md text-label-md text-text-secondary mb-space-2">Full Name</label>
                                    <input className="w-full bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all" type="text" defaultValue="Alex Rivera" />
                                </div>
                            </div>
                            <div>
                                <label className="block font-label-md text-label-md text-text-secondary mb-space-2">Email Address</label>
                                <input className="w-full bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all" type="email" defaultValue="alex.rivera@university.edu" />
                            </div>
                        </section>

                        {/* Account/Subscription */}
                        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-soft rounded-bl-full opacity-50 pointer-events-none"></div>
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle relative z-10">
                                <span className="material-symbols-outlined text-text-muted">workspace_premium</span>
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Subscription</h3>
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-space-2">
                                    <span className="font-body-base text-body-base text-text-secondary">Current Plan</span>
                                    <span className="px-3 py-1 bg-success-soft text-success rounded-full font-label-xs text-label-xs font-bold uppercase tracking-wider">Pro</span>
                                </div>
                                <p className="font-body-sm text-body-sm text-text-muted mb-space-6">Your next billing cycle begins on Oct 15, 2024.</p>
                                <button className="w-full py-space-3 px-space-4 bg-surface border border-border-default rounded-xl font-label-md text-label-md text-text-primary hover:bg-surface-soft transition-colors shadow-sm" type="button">
                                    Manage Subscription
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Right Column (Preferences) */}
                    <div className="lg:col-span-7 flex flex-col gap-space-6">
                        {/* Study Preferences */}
                        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <span className="material-symbols-outlined text-text-muted">timer</span>
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Study Preferences</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-6">
                                <div>
                                    <label className="block font-label-md text-label-md text-text-secondary mb-space-2">Daily Goal (Minutes)</label>
                                    <div className="relative">
                                        <input className="w-full bg-surface-soft border border-border-default rounded-lg pl-space-4 pr-10 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all" type="number" value={dailyGoal} onChange={(e) => setDailyGoal(e.target.value)} />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">min</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-text-secondary mb-space-2">Preferred Session Length</label>
                                    <div className="relative">
                                        <select value={sessionLength} onChange={(e) => setSessionLength(e.target.value)} className="w-full bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all appearance-none cursor-pointer">
                                            <option value="25">Pomodoro (25m)</option>
                                            <option value="45">Standard (45m)</option>
                                            <option value="60">Deep Work (60m)</option>
                                            <option value="90">Extended (90m)</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* AI Tutor Preferences */}
                        <section className="bg-ai-subtle rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <span className="material-symbols-outlined text-primary">smart_toy</span>
                                <h3 className="font-headline-sm text-headline-sm text-primary">AI Tutor Personality</h3>
                            </div>
                            <div>
                                <label className="block font-label-md text-label-md text-text-secondary mb-space-4">Teaching Style</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-4">
                                    {[
                                        { value: 'academic', icon: 'school', title: 'Academic', desc: 'Formal, precise, textbook style.' },
                                        { value: 'socratic', icon: 'forum', title: 'Socratic', desc: 'Guides with questions, makes you think.' },
                                        { value: 'simple', icon: 'child_care', title: 'ELI5', desc: 'Explain like I\'m 5, simple terms.' },
                                    ].map((style) => (
                                        <label key={style.value} className="relative flex cursor-pointer border border-border-default bg-surface p-space-4 rounded-xl hover:bg-surface-soft transition-colors focus-within:ring-2 focus-within:ring-primary-soft">
                                            <input className="sr-only peer" name="ai_tone" type="radio" value={style.value} checked={aiTone === style.value} onChange={() => setAiTone(style.value)} />
                                            <div className="peer-checked:border-primary peer-checked:bg-primary-soft absolute inset-0 rounded-xl border-2 border-transparent transition-all pointer-events-none"></div>
                                            <div className="relative z-10 flex flex-col gap-2">
                                                <span className="material-symbols-outlined text-text-muted peer-checked:text-primary">{style.icon}</span>
                                                <span className="font-label-md text-label-md text-text-primary">{style.title}</span>
                                                <span className="font-body-sm text-body-sm text-text-muted text-xs">{style.desc}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Notifications */}
                        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <span className="material-symbols-outlined text-text-muted">notifications</span>
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Notifications</h3>
                            </div>
                            <div className="flex flex-col gap-space-4">
                                {[
                                    { key: 'dailyReminders', title: 'Daily Study Reminders', desc: 'Get notified when it\'s time for your scheduled session.' },
                                    { key: 'processingAlerts', title: 'Material Processing Alerts', desc: 'Notify me when my uploads are ready to review.' },
                                    { key: 'weeklyReport', title: 'Weekly Progress Report', desc: 'Receive an email summary of your learning stats.' },
                                ].map((toggle) => (
                                    <div key={toggle.key} className="flex items-center justify-between py-space-2">
                                        <div>
                                            <h4 className="font-label-md text-label-md text-text-primary">{toggle.title}</h4>
                                            <p className="font-body-sm text-body-sm text-text-muted mt-1">{toggle.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => setNotifications(prev => ({ ...prev, [toggle.key]: !prev[toggle.key] }))}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                notifications[toggle.key] ? 'bg-primary' : 'bg-border-default'
                                            }`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                notifications[toggle.key] ? 'translate-x-6' : 'translate-x-1'
                                            }`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Form Action Bar */}
                    <div className="lg:col-span-12 mt-space-6 flex items-center justify-end gap-space-4 pt-space-6 border-t border-border-subtle">
                        <button className="py-space-3 px-space-6 bg-transparent text-text-secondary font-label-md text-label-md rounded-xl hover:bg-surface-soft transition-colors" type="button">
                            Cancel
                        </button>
                        <button className="py-space-3 px-space-8 bg-primary hover:bg-primary-hover text-on-primary font-label-md text-label-md rounded-xl shadow-md transition-all flex items-center gap-2" type="submit">
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountStudySettings;
