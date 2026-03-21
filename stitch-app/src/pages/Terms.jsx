import React from 'react';
import { Link } from 'react-router-dom';

const Terms = () => (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
        <header className="sticky top-0 z-30 w-full bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3">
                <Link to="/" aria-label="Go home" className="btn-icon w-10 h-10">
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </Link>
                <h1 className="text-body-base font-semibold text-text-main-light dark:text-text-main-dark">Terms of Service</h1>
            </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 md:px-8 py-10 pb-20">
            <div className="prose-custom">
                <p className="text-caption text-text-faint-light dark:text-text-faint-dark mb-8">Last updated: 21 March 2026</p>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">1. Agreement to Terms</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        By accessing or using ChewnPour ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. ChewnPour is operated by ChewnPour Ltd. ("we", "us", or "our").
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">2. Description of Service</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        ChewnPour is an AI-powered study platform that helps university students learn more effectively. The Service allows you to upload course materials (PDFs, lecture slides, notes) and generates structured lessons, practice quizzes, concept-building exercises, and provides an AI tutor for personalised explanations.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">3. Account Registration</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        To use the Service, you must create an account using a valid email address or Google sign-in. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 16 years old to use the Service. You agree to provide accurate and complete information when creating your account.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">4. Acceptable Use</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">You agree not to:</p>
                    <ul className="list-disc list-inside space-y-2 text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        <li>Upload content that infringes on intellectual property rights of others</li>
                        <li>Use the Service to generate content for academic dishonesty or plagiarism</li>
                        <li>Attempt to reverse-engineer, decompile, or extract the AI models or algorithms</li>
                        <li>Use automated tools to scrape or bulk-download content from the platform</li>
                        <li>Share your account credentials with others or allow others to access your account</li>
                        <li>Upload malicious files or content designed to disrupt the Service</li>
                        <li>Use the Service for any unlawful purpose</li>
                    </ul>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">5. Content and Intellectual Property</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        You retain ownership of all materials you upload to the Service. By uploading content, you grant us a limited licence to process, analyse, and transform your materials solely for the purpose of providing the Service to you. We do not claim ownership of your uploaded content.
                    </p>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        AI-generated content (lessons, quizzes, explanations) is provided for your personal educational use. The Service, its design, features, and underlying technology remain the intellectual property of ChewnPour Ltd.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">6. Payments and Credits</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        ChewnPour offers a free tier with limited uploads and paid top-up plans that provide additional upload credits and premium features. All payments are processed through our third-party payment provider. Prices are displayed in your local currency where available.
                    </p>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        Upload credits are non-refundable once used. Unused credits from top-up plans remain available until the plan's validity period expires (where applicable). We reserve the right to modify pricing with reasonable notice.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">7. AI-Generated Content Disclaimer</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        The lessons, quizzes, and explanations generated by the Service are produced by artificial intelligence and are intended as study aids only. While we strive for accuracy, AI-generated content may contain errors or inaccuracies. The Service is not a substitute for attending lectures, reading textbooks, or consulting with your instructors. You should always verify important information with authoritative sources.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">8. Service Availability</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        We aim to keep the Service available at all times but do not guarantee uninterrupted access. We may temporarily suspend the Service for maintenance, updates, or circumstances beyond our control. We will make reasonable efforts to notify users of planned downtime.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">9. Termination</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        You may delete your account at any time. We reserve the right to suspend or terminate accounts that violate these Terms. Upon termination, your uploaded content and generated materials will be deleted in accordance with our data retention practices described in our Privacy Policy.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">10. Limitation of Liability</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        To the maximum extent permitted by law, ChewnPour Ltd. shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to academic outcomes, loss of data, or interruption of service. Our total liability shall not exceed the amount you have paid to us in the twelve months preceding the claim.
                    </p>
                </section>

                <section className="space-y-4 mb-10">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">11. Changes to Terms</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        We may update these Terms from time to time. We will notify you of material changes via email or through the Service. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-body-lg font-semibold text-text-main-light dark:text-text-main-dark">12. Contact</h2>
                    <p className="text-body-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                        If you have questions about these Terms, please contact us at{' '}
                        <a href="mailto:info@chewnpour.com" className="text-primary hover:underline">info@chewnpour.com</a>.
                    </p>
                </section>
            </div>
        </main>
    </div>
);

export default Terms;
