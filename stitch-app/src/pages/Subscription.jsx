import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

const Subscription = () => {
    const [paymentMethod, setPaymentMethod] = useState('momo'); // 'momo' or 'card'
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    // Get userId from Better Auth session
    const userId = user?.id;

    // Convex mutation for upgrading
    const upgradeToPremium = useMutation(api.subscriptions.upgradeToPremium);
    const currentSubscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : 'skip');

    const handlePayment = async (e) => {
        e.preventDefault();
        if (!userId) {
            alert('Please log in to upgrade');
            return;
        }
        setLoading(true);

        try {
            // Call Convex mutation to upgrade subscription
            await upgradeToPremium({
                userId,
                amount: 35,
                currency: 'GHS',
            });

            // Navigate back to profile with success state
            navigate('/profile');
        } catch (err) {
            console.error('Payment failed:', err);
            alert('Payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="bg-gray-100/50 dark:bg-gray-900 min-h-screen flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8 font-display">
            <div className="w-full max-w-5xl bg-white dark:bg-background-dark rounded-[2rem] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-gray-100 dark:border-gray-800">

                {/* Left Panel: Summary */}
                <div className="w-full md:w-5/12 lg:w-4/12 bg-slate-50 dark:bg-gray-800/50 p-8 lg:p-10 flex flex-col border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-blue-400 to-primary/50"></div>
                    <div className="mb-4">
                        <Link to="/profile" className="flex items-center gap-2 text-text-sub-light dark:text-text-sub-dark hover:text-primary transition-colors text-sm font-bold mb-4">
                            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                            <span>Back to Profile</span>
                        </Link>
                        <h2 className="text-text-main-light dark:text-text-main-dark tracking-tight text-2xl font-bold leading-tight mb-2">Order Summary</h2>
                        <p className="text-text-sub-light dark:text-text-sub-dark text-sm font-normal leading-relaxed">
                            Review your subscription details before proceeding.
                        </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-card border border-gray-200/50 dark:border-gray-700 flex flex-col gap-4 relative overflow-hidden group mb-auto">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[11px] text-text-sub-light dark:text-text-sub-dark uppercase tracking-wider font-bold mb-1 opacity-70">Selected Plan</p>
                                <h3 className="text-text-main-light dark:text-text-main-dark text-xl font-bold">Monthly Pro</h3>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded-lg">
                                <span className="material-symbols-outlined text-primary">school</span>
                            </div>
                        </div>
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-2">
                            <div className="flex justify-between items-end">
                                <span className="text-text-sub-light dark:text-text-sub-dark text-sm font-medium">Total due</span>
                                <div className="text-right">
                                    <p className="text-text-main-light dark:text-text-main-dark text-3xl font-black tracking-tight text-primary">GHS 35</p>
                                    <p className="text-text-sub-light dark:text-text-sub-dark text-xs font-medium">/month</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="mt-8 flex items-center gap-3 opacity-70">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                            <span className="material-symbols-outlined text-green-600 text-[20px]">lock</span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-text-main-light dark:text-text-main-dark">Secure SSL Encryption</p>
                            <p className="text-[10px] text-text-sub-light dark:text-text-sub-dark">Your transaction is safe.</p>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Payment Form */}
                <div className="w-full md:w-7/12 lg:w-8/12 bg-white dark:bg-background-dark p-8 lg:p-12 flex flex-col">
                    <div className="mb-8 flex items-center justify-between">
                        <div>
                            <h2 className="text-text-main-light dark:text-text-main-dark tracking-tight text-2xl font-bold leading-tight">Payment Details</h2>
                            <p className="text-text-sub-light dark:text-text-sub-dark text-sm mt-1">Select payment method and enter details.</p>
                        </div>
                        <div className="hidden sm:flex gap-2">
                            <img alt="Visa" className="h-6 opacity-60 grayscale hover:grayscale-0 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkRlj-zTpFNPjV31UpOcL8xCeJNvRrIvOqX613AehGZUnA4nB-0wYYbbppWbwG3EZAD5NTZ-CmXEPinpQfqhaH3azR7hNVI9cWkiRoABr6nrjc2bPEgHrJNpnH8nsTur5W0YXvtF4vMthtuFUKyjcV4Qku8dQDWQUwsY1RiCtpNgKHYUvVwn7s42kCjM1MJAx007qQnvVmeA7SjIuVBBFBKdtHa-yj6Cu141fvdjMtmzzMHTm1sUJ2Bsr-A5CHxqYXH3IM4nTiQUQ" />
                            <img alt="Mastercard" className="h-6 opacity-60 grayscale hover:grayscale-0 transition-all" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCwKKweKJ6pBegsg9SWyvxGNYacWqPPlRoHpEgy688bkAF8MFCp151PEIjFrBeAXV8BoinFojbM48DozB707fehF7r43GPGrrUVHXIL4tQbbN069474IYKoYzHa6KEBMetbavO6lP_u9c5eFubgVmNqcKyD4aDYN8P_JSG2InXay8vfTGCh3oLvKNNNKSr-XFVcgQbpGiTC1tV0g-c8lDMUMFt06T1niH_1YXcNSdEbQkuPP6MyEFyaT-x_wXA2bh4nZBdjCAaZMNI" />
                        </div>
                    </div>

                    <div className="bg-gray-100/80 dark:bg-gray-800 p-1.5 rounded-xl flex mb-8 max-w-md">
                        <div className="w-1/2">
                            <input
                                id="payment-card"
                                name="payment-method"
                                type="radio"
                                className="peer hidden"
                                checked={paymentMethod === 'card'}
                                onChange={() => setPaymentMethod('card')}
                            />
                            <label
                                htmlFor="payment-card"
                                className={`block text-center py-3 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 select-none ${paymentMethod === 'card'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                Card Payment
                            </label>
                        </div>
                        <div className="w-1/2">
                            <input
                                id="payment-momo"
                                name="payment-method"
                                type="radio"
                                className="peer hidden"
                                checked={paymentMethod === 'momo'}
                                onChange={() => setPaymentMethod('momo')}
                            />
                            <label
                                htmlFor="payment-momo"
                                className={`block text-center py-3 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-200 select-none ${paymentMethod === 'momo'
                                    ? 'bg-white text-primary shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                            >
                                Mobile Money
                            </label>
                        </div>
                    </div>

                    <form className="flex flex-col gap-6 max-w-lg flex-grow" onSubmit={handlePayment}>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors text-[20px]">mail</span>
                                </div>
                                <input
                                    className="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-11 pr-4 py-3.5 text-text-main-light dark:text-text-main-dark placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
                                    placeholder="name@university.edu"
                                    type="email"
                                    defaultValue={user?.email || ''}
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="animate-fade-in-up">
                            {paymentMethod === 'momo' ? (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark ml-1">Network Provider</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors text-[20px]">wifi_tethering</span>
                                            </div>
                                            <select className="w-full appearance-none rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-11 pr-10 py-3.5 text-text-main-light dark:text-text-main-dark focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium shadow-sm hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer">
                                                <option>MTN Mobile Money</option>
                                                <option>Vodafone Cash</option>
                                                <option>AirtelTigo Money</option>
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
                                                <span className="material-symbols-outlined text-gray-400 text-[20px]">expand_more</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark ml-1">Phone Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors text-[20px]">smartphone</span>
                                            </div>
                                            <input className="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-11 pr-4 py-3.5 text-text-main-light dark:text-text-main-dark placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium font-display tracking-wide shadow-sm hover:border-gray-300 dark:hover:border-gray-600" placeholder="024 123 4567" type="tel" />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark ml-1">Card Number</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors text-[20px]">credit_card</span>
                                            </div>
                                            <input type="text" placeholder="0000 0000 0000 0000" className="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-11 pr-10 py-3.5 text-text-main-light dark:text-text-main-dark placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium font-display tracking-wide shadow-sm hover:border-gray-300 dark:hover:border-gray-600" />
                                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                                <span className="material-symbols-outlined text-green-500 text-[18px]">lock</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-1/2 space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark ml-1">Expiry Date</label>
                                            <input type="text" placeholder="MM / YY" className="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3.5 text-text-main-light dark:text-text-main-dark placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium text-center shadow-sm hover:border-gray-300 dark:hover:border-gray-600" />
                                        </div>
                                        <div className="w-1/2 space-y-2">
                                            <label className="text-xs font-bold uppercase tracking-wider text-text-sub-light dark:text-text-sub-dark ml-1">CVV</label>
                                            <div className="relative group">
                                                <input type="text" placeholder="123" className="w-full rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3.5 text-text-main-light dark:text-text-main-dark placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-sm font-medium text-center shadow-sm hover:border-gray-300 dark:hover:border-gray-600" />
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors text-[18px]">help</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30 flex gap-3 items-start mt-2">
                            <span className="material-symbols-outlined text-primary text-[20px]">info</span>
                            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                By clicking pay, you agree to our terms. Access is granted immediately after confirmation.
                            </p>
                        </div>

                        <div className="mt-6">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-primary hover:bg-primary-hover text-white font-bold text-lg py-4 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <span>{loading ? 'Processing...' : 'Pay & Unlock Access'}</span>
                                {!loading && <span className="material-symbols-outlined text-[24px]">arrow_forward</span>}
                            </button>
                            <div className="mt-6 flex justify-center items-center gap-2 opacity-50 hover:opacity-80 transition-opacity">
                                <span className="material-symbols-outlined text-gray-500 text-[18px]">verified_user</span>
                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Secured by Paystack</span>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Subscription;
