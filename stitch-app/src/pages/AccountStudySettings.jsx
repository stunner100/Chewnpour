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
        <form className="min-h-[calc(100vh-4rem)] bg-background-light" onSubmit={handleSave}>
            <div className="mx-auto max-w-5xl px-4 py-8 pb-28 md:px-8 md:py-10">
                <div className="mb-8">
                    <h1 className="font-display text-display-md font-bold tracking-[-0.02em] text-text-primary md:text-display-lg">
                        Settings
                    </h1>
                    <p className="mt-2 text-body-md text-text-secondary">
                        Manage your workspace preferences and profile.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                    <div className="flex flex-col gap-5 lg:col-span-5">
                        <section id="profile" className="scroll-mt-20 flex flex-col gap-5 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <AppIcon name="person" className="text-text-muted" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">Profile</h2>
                            </div>
                            <div className="flex items-center gap-5">
                                <div
                                    className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-surface-soft text-2xl font-bold text-text-muted shadow-sm"
                                    aria-hidden={profile?.avatarUrl ? undefined : true}
                                >
                                    {profile?.avatarUrl ? (
                                        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : initials}
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="settings-full-name" className="mb-2 block text-body-sm font-semibold text-text-secondary">
                                        Full Name
                                    </label>
                                    <input
                                        id="settings-full-name"
                                        className="w-full rounded-full border border-border-default bg-surface-soft px-4 py-3 text-body-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-soft"
                                        type="text"
                                        value={fullName}
                                        onChange={(event) => setDraftFullName(event.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="settings-email-address" className="mb-2 block text-body-sm font-semibold text-text-secondary">
                                    Email Address
                                </label>
                                <input
                                    id="settings-email-address"
                                    className="w-full rounded-full border border-border-default bg-surface-soft px-4 py-3 text-body-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-soft"
                                    type="email"
                                    value={emailAddress}
                                    readOnly
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="settings-education-level" className="mb-2 block text-body-sm font-semibold text-text-secondary">
                                        Education Level
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="settings-education-level"
                                            className="w-full cursor-pointer appearance-none rounded-full border border-border-default bg-surface-soft px-4 py-3 pr-10 text-body-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-soft"
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
                                    <label htmlFor="settings-department" className="mb-2 block text-body-sm font-semibold text-text-secondary">
                                        Department
                                    </label>
                                    <div className="relative">
                                        <select
                                            id="settings-department"
                                            className="w-full cursor-pointer appearance-none rounded-full border border-border-default bg-surface-soft px-4 py-3 pr-10 text-body-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-soft"
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
                            <p className="text-body-sm text-text-muted">
                                Education details help keep study recommendations relevant. Saving settings finishes profile setup.
                            </p>
                        </section>

                        <section id="subscription" className="scroll-mt-20 relative flex flex-col gap-5 overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                            <div className="pointer-events-none absolute right-0 top-0 size-32 rounded-bl-full bg-primary-subtle opacity-70" />
                            <div className="relative z-10 flex items-center gap-3 border-b border-border-subtle pb-4">
                                <AppIcon name="workspace_premium" className="text-text-muted" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">Subscription</h2>
                            </div>
                            <div className="relative z-10">
                                <div className="mb-2 flex items-center justify-between gap-3">
                                    <span className="text-body-sm text-text-secondary">Current Plan</span>
                                    <span className="rounded-full bg-success-soft px-3 py-1 text-caption font-bold uppercase tracking-wider text-success">
                                        {subscriptionPlanLabel}
                                    </span>
                                </div>
                                <p className="mb-5 text-body-sm text-text-muted">{subscriptionSummary}</p>
                                <div className="flex flex-col gap-3">
                                    <Link
                                        to="/subscription?from=%2Fdashboard%2Fsettings%23subscription"
                                        className="btn-primary inline-flex min-h-11 w-full items-center justify-center text-body-sm"
                                    >
                                        Buy upload credits
                                    </Link>
                                    <a
                                        href={BILLING_SUPPORT_MAILTO}
                                        className="btn-secondary inline-flex min-h-11 w-full items-center justify-center text-body-sm"
                                    >
                                        Contact Billing Support
                                    </a>
                                </div>
                            </div>
                        </section>

                        <section className="flex flex-col gap-4 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <AppIcon name="admin_panel_settings" className="text-text-muted" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">Account Access</h2>
                            </div>
                            <div>
                                <h3 className="text-body-sm font-semibold text-text-primary">Sign out of this device</h3>
                                <p className="mt-1 text-body-sm text-text-muted">
                                    End your current ChewnPour session and return to the login page.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleSignOut}
                                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-error/30 bg-surface px-4 text-body-sm font-semibold text-error transition-colors hover:bg-error-soft"
                            >
                                <AppIcon name="logout" className="text-[18px]" />
                                Sign Out
                            </button>
                        </section>
                    </div>

                    <div className="flex flex-col gap-5 lg:col-span-7">
                        <section className="flex flex-col gap-5 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <AppIcon name="timer" className="text-text-muted" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">Study Preferences</h2>
                            </div>
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                    <label htmlFor="settings-daily-goal-minutes" className="mb-2 block text-body-sm font-semibold text-text-secondary">
                                        Daily Goal (Minutes)
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="settings-daily-goal-minutes"
                                            className="w-full rounded-full border border-border-default bg-surface-soft py-3 pl-4 pr-12 text-body-sm text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary-soft"
                                            type="number"
                                            min="1"
                                            value={dailyGoal}
                                            onChange={(e) => setDraftDailyGoal(e.target.value)}
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-body-sm text-text-muted">min</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-body-sm font-semibold text-text-secondary">
                                        Preferred Session Length
                                    </label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                aria-label="Preferred session length"
                                                className="flex w-full items-center gap-3 rounded-full border border-border-default bg-surface-soft px-3 py-2 text-left outline-none transition-all hover:bg-surface-muted focus:border-primary focus:ring-2 focus:ring-primary-soft"
                                            >
                                                <AppIcon
                                                    name={selectedSessionLength.icon}
                                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-[18px] text-primary"
                                                />
                                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                                    <span className="truncate text-body-sm font-semibold text-text-primary">{selectedSessionLength.title}</span>
                                                    <span className="truncate text-caption text-text-muted">{selectedSessionLength.triggerDetail}</span>
                                                </span>
                                                <AppIcon name="unfold_more" className="text-[20px] text-text-muted" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] rounded-[16px] p-2">
                                            <div className="px-2 py-2">
                                                <p className="text-body-sm font-semibold text-text-primary">Session length</p>
                                                <p className="mt-1 text-caption text-text-muted">Choose your default study block.</p>
                                            </div>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuGroup>
                                                <DropdownMenuLabel>Options</DropdownMenuLabel>
                                                <DropdownMenuRadioGroup value={sessionLength} onValueChange={setDraftSessionLength}>
                                                    {SESSION_LENGTH_OPTIONS.map((option) => (
                                                        <DropdownMenuRadioItem
                                                            key={option.value}
                                                            value={option.value}
                                                            className="items-start gap-3 rounded-xl px-2 py-2 pr-8"
                                                        >
                                                            <AppIcon
                                                                name={option.icon}
                                                                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-[18px] text-primary"
                                                            />
                                                            <span className="flex min-w-0 flex-col gap-1">
                                                                <span className="text-body-sm font-semibold text-text-primary">{option.title}</span>
                                                                <span className="text-caption text-text-muted">{option.detail}</span>
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

                        <section className="flex flex-col gap-5 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <AppIcon name="smart_toy" className="text-primary" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">AI Tutor Personality</h2>
                            </div>
                            <div>
                                <label className="mb-4 block text-body-sm font-semibold text-text-secondary">Teaching Style</label>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                    {TUTOR_STYLE_OPTIONS.map((style) => {
                                        const selected = aiTone === style.value;
                                        return (
                                            <label
                                                key={style.value}
                                                className={`relative flex cursor-pointer rounded-[18px] border p-4 transition-colors focus-within:ring-2 focus-within:ring-primary-soft ${
                                                    selected
                                                        ? 'border-primary bg-primary-subtle'
                                                        : 'border-border-default bg-surface hover:bg-surface-soft'
                                                }`}
                                            >
                                                <input
                                                    className="sr-only"
                                                    name="ai_tone"
                                                    type="radio"
                                                    value={style.value}
                                                    checked={selected}
                                                    onChange={() => handleTutorStyleChange(style.value)}
                                                />
                                                <div className="relative z-10 flex flex-col gap-2">
                                                    <AppIcon name={style.icon} className={selected ? 'text-primary' : 'text-text-muted'} />
                                                    <span className="text-body-sm font-semibold text-text-primary">{style.title}</span>
                                                    <span className="text-caption text-text-muted">{style.desc}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        <section id="notifications" className="scroll-mt-20 flex flex-col gap-5 rounded-[24px] border border-border-subtle bg-surface p-5 shadow-sm md:p-6">
                            <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
                                <AppIcon name="notifications" className="text-text-muted" />
                                <h2 className="font-display text-display-sm font-bold text-text-primary">Notifications</h2>
                            </div>
                            <div className="flex flex-col gap-4">
                                {NOTIFICATION_OPTIONS.map((toggle) => (
                                    <div key={toggle.key} className="flex items-center justify-between gap-4 py-1">
                                        <div>
                                            <h3 className="text-body-sm font-semibold text-text-primary">{toggle.title}</h3>
                                            <p className="mt-1 text-body-sm text-text-muted">{toggle.desc}</p>
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
                                            <span
                                                aria-hidden="true"
                                                className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
                                                    notifications[toggle.key] ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-3 border-t border-border-subtle pt-6 lg:col-span-12">
                        {saveMessage && (
                            <p className={`mr-auto text-body-sm ${saveMessage.includes('saved') ? 'text-success' : 'text-error'}`}>
                                {saveMessage}
                            </p>
                        )}
                        <button
                            className="btn-secondary inline-flex min-h-11 text-body-sm"
                            type="button"
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-primary inline-flex min-h-11 items-center gap-2 text-body-sm disabled:opacity-60"
                            type="submit"
                            disabled={saving}
                        >
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
