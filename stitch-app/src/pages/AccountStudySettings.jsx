import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AppIcon from '../components/AppIcon';

const SESSION_LENGTH_OPTIONS = [
    { value: '25', title: 'Pomodoro', detail: '25m focus sprint', triggerDetail: '25m', icon: 'timer' },
    { value: '45', title: 'Standard', detail: '45m study block', triggerDetail: '45m', icon: 'schedule' },
    { value: '60', title: 'Deep Work', detail: '60m extended focus', triggerDetail: '60m', icon: 'psychology' },
    { value: '90', title: 'Extended', detail: '90m mastery session', triggerDetail: '90m', icon: 'self_improvement' },
];

const NOTIFICATION_OPTIONS = [
    { key: 'dailyReminders', title: 'Daily Study Reminders', desc: 'Get notified when it\'s time for your scheduled session.' },
    { key: 'processingAlerts', title: 'Material Processing Alerts', desc: 'Notify me when my uploads are ready to review.' },
    { key: 'weeklyProgressReport', title: 'Weekly Progress Report', desc: 'Receive an email summary of your learning stats.' },
];

const BILLING_SUPPORT_MAILTO = 'mailto:info@chewnpour.com?subject=ChewnPour%20Billing%20Support';

const TUTOR_STYLE_OPTIONS = [
    { value: 'coach', icon: 'school', title: 'Coach', desc: 'Practical, exam-ready help.' },
    { value: 'socratic', icon: 'forum', title: 'Socratic', desc: 'Guides with questions.' },
    { value: 'patient', icon: 'child_care', title: 'Patient', desc: 'Simple, step-by-step teaching.' },
];

const EDUCATION_LEVELS = [
    { value: 'freshman', label: 'Level 1' },
    { value: 'sophomore', label: 'Level 2' },
    { value: 'junior', label: 'Level 3' },
    { value: 'senior', label: 'Level 4' },
    { value: 'high_school', label: 'High School' },
    { value: 'undergrad', label: 'Undergraduate' },
    { value: 'postgrad', label: 'Postgraduate' },
    { value: 'professional', label: 'Professional' },
];

const DEPARTMENTS = [
    { value: 'cs', label: 'Computer Science' },
    { value: 'business', label: 'Business' },
    { value: 'engineering', label: 'Engineering' },
    { value: 'nursing', label: 'Nursing' },
    { value: 'economics', label: 'Economics' },
    { value: 'psychology', label: 'Psychology' },
    { value: 'arts', label: 'Arts & Design' },
    { value: 'biology', label: 'Biology' },
    { value: 'law', label: 'Law' },
    { value: 'math', label: 'Mathematics' },
];

const EDUCATION_LEVEL_VALUES = new Set(EDUCATION_LEVELS.map((option) => option.value));
const DEPARTMENT_VALUES = new Set(DEPARTMENTS.map((option) => option.value));

const normalizeEducationLevel = (value) => {
    const key = String(value || '').trim();
    return EDUCATION_LEVEL_VALUES.has(key) ? key : '';
};

const normalizeDepartment = (value) => {
    // Legacy onboarding allowed multi-select joined by commas; keep the first known value.
    const key = String(value || '')
        .split(',')
        .map((part) => part.trim())
        .find((part) => DEPARTMENT_VALUES.has(part));
    return key || '';
};

const DEFAULT_STUDY_PREFERENCES = {
    dailyGoalMinutes: 120,
    preferredSessionLength: '45',
    dailyReminders: true,
    processingAlerts: true,
    weeklyProgressReport: false,
    preferredPersona: 'coach',
};

const normalizeStudyPreferences = (value = {}) => ({
    dailyGoalMinutes: Math.max(
        1,
        Math.round(Number(value?.dailyGoalMinutes ?? DEFAULT_STUDY_PREFERENCES.dailyGoalMinutes) || DEFAULT_STUDY_PREFERENCES.dailyGoalMinutes),
    ),
    preferredSessionLength: SESSION_LENGTH_OPTIONS.some((option) => option.value === String(value?.preferredSessionLength))
        ? String(value.preferredSessionLength)
        : DEFAULT_STUDY_PREFERENCES.preferredSessionLength,
    dailyReminders: typeof value?.dailyReminders === 'boolean'
        ? value.dailyReminders
        : DEFAULT_STUDY_PREFERENCES.dailyReminders,
    processingAlerts: typeof value?.processingAlerts === 'boolean'
        ? value.processingAlerts
        : DEFAULT_STUDY_PREFERENCES.processingAlerts,
    weeklyProgressReport: typeof value?.weeklyProgressReport === 'boolean'
        ? value.weeklyProgressReport
        : DEFAULT_STUDY_PREFERENCES.weeklyProgressReport,
    preferredPersona: TUTOR_STYLE_OPTIONS.some((option) => option.value === value?.preferredPersona)
        ? value.preferredPersona
        : DEFAULT_STUDY_PREFERENCES.preferredPersona,
});

const formatPlanLabel = (plan) => {
    const value = String(plan || 'free').trim().toLowerCase();
    if (!value) return 'Free';
    return value.charAt(0).toUpperCase() + value.slice(1);
};

const AccountStudySettings = () => {
    const { user, profile, updateProfile, signOut } = useAuth();
    const navigate = useNavigate();
    const profileStudyPreferences = useMemo(
        () => normalizeStudyPreferences(profile?.studyPreferences),
        [profile?.studyPreferences],
    );
    const [draftFullName, setDraftFullName] = useState(null);
    const [draftEducationLevel, setDraftEducationLevel] = useState(null);
    const [draftDepartment, setDraftDepartment] = useState(null);
    const [draftDailyGoal, setDraftDailyGoal] = useState(null);
    const [draftSessionLength, setDraftSessionLength] = useState(null);
    const [draftAiTone, setDraftAiTone] = useState(null);
    const [draftNotifications, setDraftNotifications] = useState(null);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [billing, setBilling] = useState(null);
    const [billingStatus, setBillingStatus] = useState('loading');
    const fullName = draftFullName ?? profile?.fullName ?? user?.name ?? '';
    const educationLevel = draftEducationLevel ?? normalizeEducationLevel(profile?.educationLevel);
    const department = draftDepartment ?? normalizeDepartment(profile?.department);
    const dailyGoal = draftDailyGoal ?? profileStudyPreferences.dailyGoalMinutes;
    const sessionLength = String(draftSessionLength ?? profileStudyPreferences.preferredSessionLength);
    const notifications = draftNotifications ?? {
        dailyReminders: Boolean(profileStudyPreferences.dailyReminders),
        processingAlerts: Boolean(profileStudyPreferences.processingAlerts),
        weeklyProgressReport: Boolean(profileStudyPreferences.weeklyProgressReport),
    };
    const aiTone = draftAiTone ?? profileStudyPreferences.preferredPersona;
    const subscriptionPlanLabel = formatPlanLabel(billing?.plan);
    const remainingCredits = Math.max(0, Number(billing?.remainingUploadCredits || 0));
    const subscriptionSummary = billing
        ? `${subscriptionPlanLabel} plan · ${remainingCredits} upload credit${remainingCredits === 1 ? '' : 's'} remaining.`
        : billingStatus === 'error'
            ? 'Could not load upload credits right now.'
            : 'Loading upload credits…';

    useEffect(() => {
        if (!user?.id) {
            setBilling(null);
            setBillingStatus('idle');
            return undefined;
        }

        let cancelled = false;
        setBillingStatus('loading');

        (async () => {
            try {
                const response = await fetch('/api/billing', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || `Failed to load billing (${response.status})`);
                }
                if (!cancelled) {
                    setBilling(payload?.billing || null);
                    setBillingStatus('ready');
                }
            } catch (error) {
                console.error('Failed to load billing:', error);
                if (!cancelled) {
                    setBilling(null);
                    setBillingStatus('error');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);
    const selectedSessionLength = SESSION_LENGTH_OPTIONS.find((option) => option.value === sessionLength) || SESSION_LENGTH_OPTIONS[1];
    const emailAddress = user?.email || '';
    const initials = useMemo(() => {
        const source = fullName || user?.name || emailAddress || 'Student';
        return source
            .split(/\s+/)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || 'S';
    }, [emailAddress, fullName, user?.name]);

    const handleTutorStyleChange = (persona) => {
        setDraftAiTone(persona);
        setSaveMessage('');
    };

    const handleSave = async (event) => {
        event.preventDefault();
        setSaving(true);
        setSaveMessage('');
        const numericDailyGoal = Math.max(1, Math.round(Number(dailyGoal) || DEFAULT_STUDY_PREFERENCES.dailyGoalMinutes));
        const normalizedSessionLength = SESSION_LENGTH_OPTIONS.some((option) => option.value === String(sessionLength))
            ? String(sessionLength)
            : DEFAULT_STUDY_PREFERENCES.preferredSessionLength;
        const normalizedNotifications = {
            dailyReminders: Boolean(notifications.dailyReminders),
            processingAlerts: Boolean(notifications.processingAlerts),
            weeklyProgressReport: Boolean(notifications.weeklyProgressReport),
        };
        const normalizedAiTone = TUTOR_STYLE_OPTIONS.some((option) => option.value === aiTone)
            ? aiTone
            : TUTOR_STYLE_OPTIONS[0].value;

        const normalizedEducationLevel = normalizeEducationLevel(educationLevel);
        const normalizedDepartment = normalizeDepartment(department);

        try {
            const result = await updateProfile({
                fullName: fullName.trim(),
                educationLevel: normalizedEducationLevel || null,
                department: normalizedDepartment || null,
                onboardingCompleted: true,
                studyPreferences: {
                    dailyGoalMinutes: numericDailyGoal,
                    preferredSessionLength: normalizedSessionLength,
                    preferredPersona: normalizedAiTone,
                    ...normalizedNotifications,
                },
            });
            if (result?.error) {
                setSaveMessage(result.error.message || 'Could not save settings.');
                return;
            }

            setDraftFullName(null);
            setDraftEducationLevel(null);
            setDraftDepartment(null);
            setDraftDailyGoal(null);
            setDraftSessionLength(null);
            setDraftNotifications(null);
            setDraftAiTone(null);
            setSaveMessage('Settings saved.');
        } catch (error) {
            setSaveMessage(error?.message || 'Could not save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDraftFullName(null);
        setDraftEducationLevel(null);
        setDraftDepartment(null);
        setDraftDailyGoal(null);
        setDraftSessionLength(null);
        setDraftAiTone(null);
        setDraftNotifications(null);
        setSaveMessage('');
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };

    return (
        <form className="ml-0 md:ml-0 min-h-[calc(100vh-64px)]" onSubmit={handleSave}>
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
                        <section id="profile" className="scroll-mt-20 bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <AppIcon name="person" className="text-text-muted" />
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Profile</h3>
                            </div>
                            <div className="flex items-center gap-space-6">
                                <div
                                    className="w-20 h-20 shrink-0 rounded-full bg-surface-muted overflow-hidden border-2 border-surface shadow-sm flex items-center justify-center text-2xl font-bold text-text-muted"
                                    aria-hidden={profile?.avatarUrl ? undefined : true}
                                >
                                    {profile?.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : initials}
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="settings-full-name" className="block font-label-md text-label-md text-text-secondary mb-space-2">Full Name</label>
                                    <input id="settings-full-name" className="w-full bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all" type="text" value={fullName} onChange={(event) => setDraftFullName(event.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="settings-email-address" className="block font-label-md text-label-md text-text-secondary mb-space-2">Email Address</label>
                                <input id="settings-email-address" className="w-full bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all" type="email" value={emailAddress} readOnly />
                            </div>
                            <div className="grid grid-cols-1 gap-space-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="settings-education-level" className="block font-label-md text-label-md text-text-secondary mb-space-2">Education Level</label>
                                    <div className="relative">
                                        <select
                                            id="settings-education-level"
                                            className="w-full appearance-none bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 pr-10 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all cursor-pointer"
                                            value={educationLevel}
                                            onChange={(event) => {
                                                setDraftEducationLevel(event.target.value);
                                                setSaveMessage('');
                                            }}
                                        >
                                            <option value="">Select your level</option>
                                            {EDUCATION_LEVELS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <AppIcon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="settings-department" className="block font-label-md text-label-md text-text-secondary mb-space-2">Department</label>
                                    <div className="relative">
                                        <select
                                            id="settings-department"
                                            className="w-full appearance-none bg-surface-soft border border-border-default rounded-lg px-space-4 py-space-3 pr-10 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all cursor-pointer"
                                            value={department}
                                            onChange={(event) => {
                                                setDraftDepartment(event.target.value);
                                                setSaveMessage('');
                                            }}
                                        >
                                            <option value="">Select your department</option>
                                            {DEPARTMENTS.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                        <AppIcon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted" />
                                    </div>
                                </div>
                            </div>
                            <p className="font-body-sm text-body-sm text-text-muted">
                                Education details help keep study recommendations relevant. Saving settings finishes profile setup.
                            </p>
                        </section>

                        {/* Account/Subscription */}
                        <section id="subscription" className="scroll-mt-20 bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-soft rounded-bl-full opacity-50 pointer-events-none"></div>
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle relative z-10">
                                <AppIcon name="workspace_premium" className="text-text-muted" />
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Subscription</h3>
                            </div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-space-2">
                                    <span className="font-body-base text-body-base text-text-secondary">Current Plan</span>
                                    <span className="px-3 py-1 bg-success-soft text-success rounded-full font-label-xs text-label-xs font-bold uppercase tracking-wider">
                                        {subscriptionPlanLabel}
                                    </span>
                                </div>
                                <p className="font-body-sm text-body-sm text-text-muted mb-space-6">{subscriptionSummary}</p>
                                <div className="flex flex-col gap-space-3">
                                    <Link
                                        to="/subscription?from=%2Fdashboard%2Fsettings%23subscription"
                                        className="flex w-full items-center justify-center py-space-3 px-space-4 bg-primary text-white rounded-xl font-label-md text-label-md hover:opacity-95 transition-opacity shadow-sm"
                                    >
                                        Buy upload credits
                                    </Link>
                                    <a href={BILLING_SUPPORT_MAILTO} className="flex w-full items-center justify-center py-space-3 px-space-4 bg-surface border border-border-default rounded-xl font-label-md text-label-md text-text-primary hover:bg-surface-soft transition-colors shadow-sm">
                                        Contact Billing Support
                                    </a>
                                </div>
                            </div>
                        </section>

                        {/* Account Access */}
                        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-5">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <AppIcon name="admin_panel_settings" className="text-text-muted" />
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Account Access</h3>
                            </div>
                            <div>
                                <h4 className="font-label-md text-label-md text-text-primary">Sign out of this device</h4>
                                <p className="mt-space-1 font-body-sm text-body-sm text-text-muted">
                                    End your current ChewnPour session and return to the login page.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="flex w-full items-center justify-center gap-space-2 rounded-xl border border-error/30 bg-surface px-space-4 py-space-3 font-label-md text-label-md text-error transition-colors hover:bg-error-soft"
                            >
                                <AppIcon name="logout" className="text-[18px]" />
                                Sign Out
                            </button>
                        </section>
                    </div>

                    {/* Right Column (Preferences) */}
                    <div className="lg:col-span-7 flex flex-col gap-space-6">
                        {/* Study Preferences */}
                        <section className="bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <AppIcon name="timer" className="text-text-muted" />
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Study Preferences</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-6">
                                <div>
                                    <label htmlFor="settings-daily-goal-minutes" className="block font-label-md text-label-md text-text-secondary mb-space-2">Daily Goal (Minutes)</label>
                                    <div className="relative">
                                        <input id="settings-daily-goal-minutes" className="w-full bg-surface-soft border border-border-default rounded-lg pl-space-4 pr-10 py-space-3 font-body-base text-text-primary focus:ring-2 focus:ring-primary-soft focus:border-primary outline-none transition-all" type="number" min="1" value={dailyGoal} onChange={(e) => setDraftDailyGoal(e.target.value)} />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted text-sm">min</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-label-md text-label-md text-text-secondary mb-space-2">Preferred Session Length</label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label="Preferred session length"
                                                className="flex w-full items-center gap-space-3 rounded-lg border border-border-default bg-surface-soft px-space-3 py-space-2 text-left font-body-base text-text-primary outline-none transition-all hover:bg-surface-muted focus:border-primary focus:ring-2 focus:ring-primary-soft"
                                            >
                                                <AppIcon
                                                    name={selectedSessionLength.icon}
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[18px] text-primary"
                                                />
                                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                                    <span className="truncate font-label-md text-label-md text-text-primary">{selectedSessionLength.title}</span>
                                                    <span className="truncate font-body-sm text-body-sm text-text-muted">{selectedSessionLength.triggerDetail}</span>
                                                </span>
                                                <AppIcon name="unfold_more" className="text-[20px] text-text-muted" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] p-space-2">
                                            <div className="px-space-2 py-space-2">
                                                <p className="font-label-md text-label-md text-text-primary">Session length</p>
                                                <p className="mt-1 font-body-sm text-body-sm text-text-muted">Choose your default study block.</p>
                                            </div>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuLabel>Options</DropdownMenuLabel>
                                                <DropdownMenuRadioGroup value={sessionLength} onValueChange={setDraftSessionLength}>
                                                    {SESSION_LENGTH_OPTIONS.map((option) => (
                                                        <DropdownMenuRadioItem
                                                            key={option.value}
                                                            value={option.value}
                                                            className="items-start gap-space-3 rounded-lg px-space-2 py-space-2 pr-space-8"
                                                        >
                                                            <AppIcon
                                                                name={option.icon}
                                                                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-[18px] text-primary"
                                                            />
                                                            <span className="flex min-w-0 flex-col gap-1">
                                                                <span className="font-label-md text-label-md text-text-primary">{option.title}</span>
                                                                <span className="font-body-sm text-body-sm text-text-muted">{option.detail}</span>
                                                            </span>
                                                        </DropdownMenuRadioItem>
                                                    ))}
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </section>

                        {/* AI Tutor Preferences */}
                        <section className="settings-tutor-card bg-ai-subtle dark:!bg-[#161719] rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <AppIcon name="smart_toy" className="text-primary" />
                                <h3 className="font-headline-sm text-headline-sm text-primary">AI Tutor Personality</h3>
                            </div>
                            <div>
                                <label className="block font-label-md text-label-md text-text-secondary mb-space-4">Teaching Style</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-4">
                                    {TUTOR_STYLE_OPTIONS.map((style) => {
                                        const selected = aiTone === style.value;
                                        return (
                                            <label key={style.value} className={`relative flex cursor-pointer rounded-xl border p-space-4 transition-colors focus-within:ring-2 focus-within:ring-primary-soft ${selected ? 'border-primary bg-primary-soft dark:!bg-[#2a241c]' : 'border-border-default bg-surface dark:!bg-[#111214] hover:bg-surface-soft dark:hover:!bg-[#212226]'}`}>
                                                <input className="sr-only" name="ai_tone" type="radio" value={style.value} checked={selected} onChange={() => handleTutorStyleChange(style.value)} />
                                                <div className="relative z-10 flex flex-col gap-2">
                                                    <AppIcon name={style.icon} className={selected ? 'text-primary' : 'text-text-muted'} />
                                                    <span className="font-label-md text-label-md text-text-primary">{style.title}</span>
                                                    <span className="font-body-sm text-body-sm text-text-muted text-xs">{style.desc}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        {/* Notifications */}
                        <section id="notifications" className="scroll-mt-20 bg-surface rounded-2xl border border-border-subtle shadow-sm p-space-8 flex flex-col gap-space-6">
                            <div className="flex items-center gap-space-3 pb-space-4 border-b border-border-subtle">
                                <AppIcon name="notifications" className="text-text-muted" />
                                <h3 className="font-headline-sm text-headline-sm text-text-primary">Notifications</h3>
                            </div>
                            <div className="flex flex-col gap-space-4">
                                {NOTIFICATION_OPTIONS.map((toggle) => (
                                    <div key={toggle.key} className="flex items-center justify-between gap-space-4 py-space-2">
                                        <div>
                                            <h4 className="font-label-md text-label-md text-text-primary">{toggle.title}</h4>
                                            <p className="font-body-sm text-body-sm text-text-muted mt-1">{toggle.desc}</p>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={Boolean(notifications[toggle.key])}
                                            aria-label={`${toggle.title}: ${notifications[toggle.key] ? 'on' : 'off'}`}
                                            onClick={() => setDraftNotifications((prev) => {
                                                const current = prev ?? notifications;
                                                return { ...current, [toggle.key]: !current[toggle.key] };
                                            })}
                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                                notifications[toggle.key] ? 'bg-primary' : 'bg-border-default'
                                            }`}
                                        >
                                            <span aria-hidden="true" className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
                        {saveMessage && (
                            <p className={`mr-auto font-body-sm text-body-sm ${saveMessage.includes('saved') ? 'text-success' : 'text-error'}`}>{saveMessage}</p>
                        )}
                        <button className="py-space-3 px-space-6 bg-transparent text-text-secondary font-label-md text-label-md rounded-xl hover:bg-surface-soft transition-colors" type="button" onClick={handleCancel}>
                            Cancel
                        </button>
                        <button className="py-space-3 px-space-8 bg-primary hover:bg-primary-hover text-on-primary font-label-md text-label-md rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-60" type="submit" disabled={saving}>
                            <AppIcon name="save" className="text-[18px]" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
};

export default AccountStudySettings;
