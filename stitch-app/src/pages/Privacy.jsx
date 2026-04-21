import React from 'react';
import PublicShell from '../components/PublicShell';

const Privacy = () => (
    <PublicShell>
        <article className="cp-prose max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#B39DFF] mb-4">
                <span className="inline-block w-8 h-[2px] bg-[#B39DFF]" /> Legal
            </div>
            <h1>Privacy Policy</h1>
            <p className="text-white/50 text-sm">Last updated: 21 March 2026</p>

            <h2>1. Introduction</h2>
            <p>
                ChewnPour Ltd. ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, store, and share your personal information when you use the ChewnPour
                platform ("the Service"). By using the Service, you consent to the practices described in this policy.
            </p>

            <h2>2. Information We Collect</h2>
            <h3>Account Information</h3>
            <p>
                When you create an account, we collect your name, email address, and profile information. If you sign
                in with Google, we receive your name, email address, and profile picture from Google.
            </p>
            <h3>Uploaded Content</h3>
            <p>
                We collect and process the course materials you upload (PDFs, lecture slides, notes) solely to generate
                lessons, quizzes, and AI tutor responses for you. Your uploaded files are stored securely and are not
                shared with other users.
            </p>
            <h3>Usage Data</h3>
            <p>
                We automatically collect information about how you interact with the Service, including pages visited,
                features used, quiz results, study session duration, device type, browser type, and IP address. This
                data helps us improve the Service and your learning experience.
            </p>
            <h3>Payment Information</h3>
            <p>
                Payment transactions are processed by our third-party payment provider. We do not store your full
                credit card or mobile money details on our servers. We retain transaction records (amount, date, plan
                purchased) for billing and support purposes.
            </p>

            <h2>3. How We Use Your Information</h2>
            <ul>
                <li>To provide, maintain, and improve the Service</li>
                <li>To process your uploaded materials and generate personalised study content</li>
                <li>To power AI tutor conversations tailored to your course materials</li>
                <li>To process payments and manage your account credits</li>
                <li>To send you important service updates and notifications</li>
                <li>To analyse usage patterns and improve our AI models and features</li>
                <li>To detect and prevent fraud, abuse, and security incidents</li>
                <li>To respond to your support requests</li>
            </ul>

            <h2>4. AI Processing</h2>
            <p>
                Your uploaded materials are processed by AI systems to generate lessons, quizzes, and tutor responses.
                This processing occurs on secure servers. We may use anonymised and aggregated data from user
                interactions to improve our AI models, but your individual uploaded content is never used to train
                models shared with other users. You can delete your uploaded materials at any time, which removes them
                from active processing.
            </p>

            <h2>5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share your data with:</p>
            <ul>
                <li>
                    <strong>Service providers</strong> — cloud hosting, payment processing, email delivery, and
                    analytics providers who help us operate the Service, bound by data protection agreements
                </li>
                <li>
                    <strong>AI model providers</strong> — your content may be sent to third-party AI services for
                    processing, subject to their enterprise data processing terms which prohibit training on your data
                </li>
                <li>
                    <strong>Legal obligations</strong> — when required by law, court order, or to protect the rights,
                    safety, or property of ChewnPour, our users, or the public
                </li>
                <li>
                    <strong>Business transfers</strong> — in the event of a merger, acquisition, or sale of assets,
                    your data may be transferred as part of the transaction
                </li>
            </ul>

            <h2>6. Data Storage and Security</h2>
            <p>
                Your data is stored on secure servers with encryption at rest and in transit. We implement
                industry-standard security measures including access controls, regular security audits, and
                monitoring. While we take all reasonable precautions, no method of electronic storage is 100% secure,
                and we cannot guarantee absolute security.
            </p>

            <h2>7. Data Retention</h2>
            <p>
                We retain your account information and uploaded content for as long as your account is active. When
                you delete your account, we will delete your personal data and uploaded materials within 30 days,
                except where we are required by law to retain certain records (such as payment transaction data, which
                we retain for up to 7 years for tax and compliance purposes). Anonymised and aggregated data may be
                retained indefinitely.
            </p>

            <h2>8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul>
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Export your data in a portable format</li>
                <li>Object to or restrict certain processing</li>
                <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p>
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:info@chewnpour.com">info@chewnpour.com</a>. We will respond within 30 days.
            </p>

            <h2>9. Cookies and Tracking</h2>
            <p>
                We use essential cookies to keep you signed in and remember your preferences (such as dark mode). We
                may use analytics tools to understand how the Service is used. We do not use third-party advertising
                cookies or tracking pixels.
            </p>

            <h2>10. Children's Privacy</h2>
            <p>
                The Service is intended for users aged 16 and older. We do not knowingly collect personal information
                from children under 16. If we learn that we have collected data from a child under 16, we will take
                steps to delete that information promptly.
            </p>

            <h2>11. Changes to This Policy</h2>
            <p>
                We may update this Privacy Policy from time to time. We will notify you of material changes via email
                or a prominent notice within the Service. Your continued use of the Service after changes take effect
                constitutes acceptance of the updated policy.
            </p>

            <h2>12. Contact</h2>
            <p>
                If you have questions or concerns about this Privacy Policy or how we handle your data, please contact
                us at <a href="mailto:info@chewnpour.com">info@chewnpour.com</a>.
            </p>
        </article>
    </PublicShell>
);

export default Privacy;
