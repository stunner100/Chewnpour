import React, { useEffect, useMemo, useReducer } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { m as Motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';
import { BlurFade } from '../components/magicui/BlurFade';
import { OnboardingProgress } from '../components/onboarding/OnboardingProgress';
import { WatermelonToaster } from '../components/watermelon/WatermelonSonner';
import { watermelonToast } from '../components/watermelon/watermelonToast';
import AppIcon from '../components/AppIcon';

const ACCENT = 'rgb(13, 148, 136)';
const PAGE_BG = '#FAFAFB';
const SUBTEXT = '#687384';
const INPUT_BG = '#FFFFFF';
const BORDER = '#D9D2C6';
const TEXT_MAIN = '#1F2933';

const NAME_FORM_ID = 'onboarding-name-form';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialNameState = {
    name: '',
    email: '',
    password: '',
    error: '',
    touched: { name: false, email: false, password: false },
    loading: false,
};

const nameReducer = (state, action) => {
    switch (action.type) {
        case 'fieldChanged':
            return {
                ...state,
                [action.field]: action.value,
                error: state.error ? '' : state.error,
            };
        case 'fieldBlurred':
            return {
                ...state,
                touched: {
                    ...state.touched,
                    [action.field]: true,
                },
            };
        case 'submitStarted':
            return {
                ...state,
                error: '',
                loading: true,
            };
        case 'submitFailed':
            return {
                ...state,
                error: action.error,
                loading: false,
            };
        case 'submitFinished':
            return {
                ...state,
                loading: false,
            };
        default:
            return state;
    }
};

// react-doctor-disable-next-line react-doctor/no-giant-component
const OnboardingName = () => {
    const [{ name, email, password, error, touched, loading }, dispatchName] = useReducer(
        nameReducer,
        initialNameState,
    );
    const { signUp, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const referralCode = useMemo(
        () => (searchParams.get('ref') || '').trim().toUpperCase(),
        [searchParams],
    );

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const isNameValid = trimmedName.length > 0;
    const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
    const isPasswordValid = password.length >= 6;
    const isSubmitDisabled = loading || !isNameValid || !isEmailValid || !isPasswordValid;

    useEffect(() => {
        if (authLoading) return;
        if (profile?.onboardingCompleted) navigate('/dashboard', { replace: true });
    }, [profile, authLoading, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isNameValid) {
            dispatchName({ type: 'submitFailed', error: 'Please enter your name' });
            return;
        }
        if (!isEmailValid) {
            dispatchName({
                type: 'submitFailed',
                error: trimmedEmail ? 'Please enter a valid email address' : 'Please enter your email',
            });
            return;
        }
        if (!isPasswordValid) {
            dispatchName({ type: 'submitFailed', error: 'Password must be at least 6 characters' });
            return;
        }

        dispatchName({ type: 'submitStarted' });
        try {
            const { error } = await signUp(trimmedEmail, password, trimmedName);
            if (error) {
                dispatchName({ type: 'submitFailed', error: error.message });
                watermelonToast(error.message, { type: 'error' });
            } else {
                if (referralCode) {
                    // Referral persistence moves with the Supabase domain cutover.
                    watermelonToast(`Referral ${referralCode} noted for later linking.`, {
                        type: 'info',
                    });
                }
                navigate('/dashboard', {
                    replace: true,
                    state: {
                        watermelonToast: {
                            message: `Welcome, ${trimmedName.split(' ')[0]}!`,
                            type: 'success',
                        },
                    },
                });
            }
        } catch {
            const fallback = 'An unexpected error occurred';
            dispatchName({ type: 'submitFailed', error: fallback });
            watermelonToast(fallback, { type: 'error' });
        } finally {
            dispatchName({ type: 'submitFinished' });
        }
    };

    const fieldBorder = (valid, isTouched, value) => {
        if (!isTouched && !value) return BORDER;
        return valid ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 68, 68, 0.55)';
    };

    const inputStyle = (valid, isTouched, value) => ({
        width: '100%',
        height: 52,
        padding: '0 16px',
        borderRadius: 12,
        background: INPUT_BG,
        border: `1px solid ${fieldBorder(valid, isTouched, value)}`,
        color: TEXT_MAIN,
        fontSize: 15,
        fontFamily: 'DM Sans, sans-serif',
        outline: 'none',
        transition: 'border-color 0.15s ease',
    });

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: PAGE_BG, color: TEXT_MAIN, fontFamily: '"Space Grotesk", "DM Sans", system-ui, sans-serif' }}
        >
            {/* Header — logo + progress + step indicator */}
            <header className="w-full pt-6 pb-2 px-6">
                <div className="max-w-md mx-auto">
                    <Link to="/" className="flex items-center gap-2.5 text-[#0F766E] mb-5" aria-label="ChewnPour home">
                        <BrandLogo size={28} decorative />
                    </Link>
                    <OnboardingProgress step={1} total={3} />
                    <div className="flex items-center justify-between mt-4">
                        <Link
                            to="/signup"
                            className="inline-flex items-center justify-center size-9 rounded-full text-[#687384] hover:text-[#1F2933] hover:bg-[#F3EEE7] transition-colors"
                            aria-label="Back"
                        >
                            <AppIcon name="arrow_back" className="text-[20px]" />
                        </Link>
                        <span className="text-xs font-semibold ui-text" style={{ color: SUBTEXT, fontFamily: 'DM Sans, sans-serif' }}>
                            Step 1 of 3
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full flex flex-col items-center justify-start px-6 pt-6 pb-32">
                <form
                    id={NAME_FORM_ID}
                    onSubmit={handleSubmit}
                    className="w-full max-w-md"
                >
                    <BlurFade delay={0.05} yOffset={12}>
                        <h1
                            style={{
                                fontFamily: 'Space Grotesk, sans-serif',
                                fontWeight: 600,
                                fontSize: 'clamp(32px, 5vw, 44px)',
                                lineHeight: 1.05,
                                letterSpacing: '-0.025em',
                                marginBottom: 12,
                            }}
                        >
                            Create your <span style={{ color: ACCENT }}>account</span>
                        </h1>
                    </BlurFade>
                    <BlurFade delay={0.15} yOffset={10}>
                        <p style={{ color: SUBTEXT, fontSize: 16, lineHeight: 1.55, marginBottom: 32 }}>
                            Tell us a bit about yourself to get started.
                        </p>
                    </BlurFade>

                    {referralCode && (
                        <BlurFade delay={0.2} yOffset={8}>
                            <div
                                className="mb-6 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5"
                                style={{ background: 'rgba(13, 148, 136,0.1)', border: `1px solid ${ACCENT}66`, color: ACCENT, fontFamily: 'DM Sans, sans-serif' }}
                            >
                                <AppIcon name="redeem" className="text-[18px]" />
                                You were referred! Sign up and upload to earn a free credit.
                            </div>
                        </BlurFade>
                    )}

                    {error && (
                        <Motion.div
                            role="alert"
                            aria-atomic="true"
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="mb-6 p-3.5 rounded-xl text-sm font-medium flex items-center gap-2.5"
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: 'rgb(185,28,28)', fontFamily: 'DM Sans, sans-serif' }}
                        >
                            <AppIcon name="error" className="text-[18px]" />
                            {error}
                        </Motion.div>
                    )}

                    <BlurFade delay={0.25} yOffset={10} className="space-y-5">
                        {/* Name */}
                        <div className="space-y-2">
                            <label htmlFor="onboarding-name" className="text-sm font-semibold text-[#1F2933]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                                Your name
                            </label>
                            <input
                                id="onboarding-name"
                                style={inputStyle(isNameValid, touched.name, name)}
                                placeholder="What should we call you?"
                                type="text"
                                value={name}
                                onChange={(e) => dispatchName({
                                    type: 'fieldChanged',
                                    field: 'name',
                                    value: e.target.value,
                                })}
                                onBlur={() => dispatchName({ type: 'fieldBlurred', field: 'name' })}
                                required
                            />
                            {(touched.name || name.length > 0) && (
                                <p className="text-xs" style={{ color: isNameValid ? 'rgb(74,222,128)' : 'rgb(252,165,165)', fontFamily: 'DM Sans, sans-serif' }}>
                                    {isNameValid ? 'Looks good.' : 'Enter your name to continue.'}
                                </p>
                            )}
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <label htmlFor="onboarding-email" className="text-sm font-semibold text-[#1F2933]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                                Email address
                            </label>
                            <input
                                id="onboarding-email"
                                style={inputStyle(isEmailValid, touched.email, email)}
                                placeholder="student@university.edu"
                                type="email"
                                value={email}
                                onChange={(e) => dispatchName({
                                    type: 'fieldChanged',
                                    field: 'email',
                                    value: e.target.value,
                                })}
                                onBlur={() => dispatchName({ type: 'fieldBlurred', field: 'email' })}
                                required
                            />
                            {(touched.email || email.length > 0) && (
                                <p className="text-xs" style={{ color: isEmailValid ? 'rgb(74,222,128)' : 'rgb(252,165,165)', fontFamily: 'DM Sans, sans-serif' }}>
                                    {isEmailValid ? 'Valid email address.' : 'Enter a valid email address.'}
                                </p>
                            )}
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <label htmlFor="onboarding-password" className="text-sm font-semibold text-[#1F2933]" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                                Password
                            </label>
                            <input
                                id="onboarding-password"
                                style={inputStyle(isPasswordValid, touched.password, password)}
                                placeholder="Create a strong password"
                                type="password"
                                value={password}
                                onChange={(e) => dispatchName({
                                    type: 'fieldChanged',
                                    field: 'password',
                                    value: e.target.value,
                                })}
                                onBlur={() => dispatchName({ type: 'fieldBlurred', field: 'password' })}
                                minLength={6}
                                required
                            />
                            {(touched.password || password.length > 0) && (
                                <p className="text-xs" style={{ color: isPasswordValid ? 'rgb(74,222,128)' : 'rgb(252,165,165)', fontFamily: 'DM Sans, sans-serif' }}>
                                    {isPasswordValid ? 'Strong enough.' : 'At least 6 characters required.'}
                                </p>
                            )}
                        </div>
                    </BlurFade>

                    <BlurFade delay={0.35} yOffset={6}>
                        <p className="mt-6 text-center text-sm" style={{ color: SUBTEXT, fontFamily: 'DM Sans, sans-serif' }}>
                            Already have an account?{' '}
                            <Link to="/login" className="font-semibold hover:underline" style={{ color: ACCENT }}>
                                Sign in
                            </Link>
                        </p>
                    </BlurFade>
                </form>
            </main>

            {/* Sticky bottom CTA */}
            <div
                className="fixed bottom-0 left-0 w-full p-5 pointer-events-none"
                style={{
                    background: `linear-gradient(to top, ${PAGE_BG} 60%, transparent)`,
                    paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))',
                }}
            >
                <div className="max-w-md mx-auto pointer-events-auto">
                    <button
                        type="submit"
                        form={NAME_FORM_ID}
                        disabled={isSubmitDisabled}
                        className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-lg text-white text-sm font-bold transition-opacity"
                        style={{
                            background: ACCENT,
                            fontFamily: 'DM Sans, sans-serif',
                            opacity: isSubmitDisabled ? 0.45 : 1,
                            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full size-4 border-2 border-white/30 border-t-white" />
                                <span>Creating account…</span>
                            </>
                        ) : (
                            <span>Continue</span>
                        )}
                    </button>
                </div>
            </div>
            <WatermelonToaster position="bottom-center" />
        </div>
    );
};

export default OnboardingName;
