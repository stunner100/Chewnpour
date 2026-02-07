import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signInWithGoogle } = useAuth();
    const navigate = useNavigate();

    const handleGoogleSignIn = async () => {
        setLoading(true);
        // We don't necessarily need to catch error here as redirect happens, but good practice
        const { error } = await signInWithGoogle();
        if (error) {
            setError(error.message || 'Failed to sign in with Google');
            setLoading(false);
        }
        // Redirect happens automatically via callbackURL
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error } = await signIn(email, password);
            if (error) {
                setError(error.message);
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex flex-col bg-background-light dark:bg-background-dark font-body antialiased overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 bg-mesh-light dark:bg-mesh-dark pointer-events-none"></div>
            <div className="fixed top-[-30%] right-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px] pointer-events-none animate-float-slow"></div>
            <div className="fixed bottom-[-30%] left-[-20%] w-[60%] h-[60%] bg-secondary/8 rounded-full blur-[150px] pointer-events-none animate-float-slow animate-delay-500"></div>

            <div className="relative z-10 flex items-center p-4 justify-between">
                <Link to="/" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm hover:bg-primary/10 transition-all shadow-sm border border-neutral-200/50 dark:border-neutral-800/50">
                    <span className="material-symbols-outlined text-text-main-light dark:text-text-main-dark" style={{ fontSize: '22px' }}>arrow_back</span>
                </Link>
            </div>

            <main className="relative z-10 flex-1 flex flex-col px-6 max-w-md mx-auto w-full pb-8">
                <div className="pt-4 pb-8 animate-fade-in-up">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-button mb-6">
                        <span className="material-symbols-outlined text-[32px] filled">school</span>
                    </div>
                    <h1 className="text-text-main-light dark:text-text-main-dark tracking-tight text-3xl font-display font-bold leading-tight mb-2">Welcome back</h1>
                    <p className="text-text-sub-light dark:text-text-sub-dark text-base font-medium">Login to your campus account</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-secondary/10 border border-secondary/20 text-secondary text-sm font-medium flex items-center gap-3 animate-scale-in">
                        <span className="material-symbols-outlined text-[20px]">error</span>
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-3 animate-fade-in-up animate-delay-100">
                    <button onClick={handleGoogleSignIn} disabled={loading} className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-14 px-4 bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 hover:border-primary/30 hover:shadow-card-hover transition-all gap-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                        </svg>
                        <span className="text-text-main-light dark:text-text-main-dark">
                            {loading && !email ? 'Connecting...' : 'Login with Google'}
                        </span>
                    </button>
                    <button className="group relative flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl h-14 px-4 bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 hover:border-primary/30 hover:shadow-card-hover transition-all gap-3 text-sm font-bold">
                        <svg className="w-5 h-5 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M13.6004 2.12879C12.876 2.12879 12.1827 2.49392 11.5033 2.91021C11.0267 3.20038 10.596 3.52846 10.2644 3.7335C9.76189 4.04351 9.27702 4.34185 8.78441 4.34185C8.76127 4.34185 8.73663 4.34108 8.71123 4.34108C8.72355 4.33184 8.7405 4.32183 8.75975 4.31259C8.35851 4.54284 7.90412 4.88785 7.42045 5.37842C6.35715 6.45271 5.48512 8.35775 5.48512 10.7302C5.48512 13.0652 6.43801 15.5489 8.24075 18.156C9.11244 19.4189 10.1581 20.9323 11.5834 20.9323C12.1935 20.9323 12.4338 20.7629 13.1669 20.4733C13.9117 20.1807 14.1951 20.0713 14.9391 20.0713C15.6831 20.0713 15.9357 20.1714 16.7111 20.4672C17.4704 20.7568 17.7015 20.9323 18.2868 20.9323C19.7423 20.9323 20.9404 19.2618 21.6919 18.1698C22.2571 17.3489 22.8463 16.148 23.0759 15.0221C23.1098 14.8588 23.1513 14.6124 23.1513 14.5985C23.1344 14.5939 23.102 14.5877 23.0774 14.5816C23.0512 14.577 23.0189 14.5708 22.9804 14.5585C22.0286 14.198 21.3201 13.2793 21.3201 12.0857C21.3201 10.0279 23.0066 8.87531 23.0574 8.84143L23.1498 8.77827C22.6569 8.07747 21.9052 7.55838 21.0374 7.21951C20.1548 6.87754 19.2045 6.78666 18.2437 6.94685L17.7662 7.0254L17.3996 6.79127C16.9498 6.50478 16.4954 6.22137 15.9963 6.00266C15.2278 5.66687 14.4391 5.4959 13.6266 5.4959C13.6174 5.4959 13.6128 5.4959 13.6004 5.4959V2.12879ZM16.3244 2.37832C16.3537 2.12879 16.3691 1.87926 16.3691 1.63281C16.3691 1.41101 16.3475 1.19691 16.3152 1.00283L16.2998 0.908863H16.2058C16.0087 0.925807 15.7976 0.941211 15.5866 0.941211C14.5162 0.941211 13.4372 1.48803 12.7224 2.35521C12.0169 3.20857 11.5834 4.41733 11.7513 5.6638C11.7698 5.7932 11.796 5.918 11.8314 6.03661L11.8607 6.13674H11.9654C12.1626 6.11979 12.352 6.10439 12.5483 6.10439C13.6235 6.10439 14.8875 5.5683 15.6328 4.67305C16.1427 4.06151 16.4261 3.2363 16.3244 2.37832Z"></path>
                        </svg>
                        <span className="text-text-main-light dark:text-text-main-dark">Login with Apple</span>
                    </button>
                </div>

                <div className="relative py-8 flex items-center animate-fade-in-up animate-delay-200">
                    <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                    <span className="flex-shrink-0 mx-4 text-neutral-400 dark:text-neutral-600 text-xs font-bold uppercase tracking-wider">or continue with email</span>
                    <div className="flex-grow border-t border-neutral-200 dark:border-neutral-800"></div>
                </div>

                <form className="flex flex-col gap-5 animate-fade-in-up animate-delay-300" onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="email">Email Address</label>
                        <input
                            className="input-field"
                            id="email"
                            placeholder="student@university.edu"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-text-main-light dark:text-text-main-dark ml-1" htmlFor="password">Password</label>
                        <div className="relative group">
                            <input
                                className="input-field !pr-12"
                                id="password"
                                placeholder="Enter your password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-primary transition-colors"
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                                    {showPassword ? 'visibility' : 'visibility_off'}
                                </span>
                            </button>
                        </div>
                        <div className="flex justify-end mt-1">
                            <Link className="text-primary hover:text-primary-dark text-sm font-semibold transition-colors animated-underline" to="/reset-password">
                                Forgot Password?
                            </Link>
                        </div>
                    </div>
                    <button
                        className="mt-4 btn-primary h-14 w-full flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <>
                                <span>Log In</span>
                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>
            </main>

            <footer className="relative z-10 p-6 text-center">
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">
                    New here? <Link to="/signup" className="text-primary hover:text-primary-dark font-bold ml-1 transition-colors animated-underline">Sign up</Link>
                </p>
            </footer>
        </div>
    );
};

export default Login;
