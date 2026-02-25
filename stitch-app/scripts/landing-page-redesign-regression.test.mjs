/**
 * Regression test: Landing page redesign
 *
 * Verifies the landing page redesign maintains all required functionality
 * while implementing the new warm, light-mode design.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, '../src/pages/LandingPage.jsx'), 'utf-8');

let passed = 0;
let failed = 0;

const assert = (condition, label) => {
    if (condition) {
        console.log(`  ✓ ${label}`);
        passed++;
    } else {
        console.error(`  ✗ ${label}`);
        failed++;
    }
};

console.log('--- Landing page redesign regression ---\n');

// Core functionality preserved
assert(source.includes('useAuth'), 'Uses useAuth hook');
assert(source.includes("navigate('/dashboard'"), 'Redirects logged-in users to dashboard');
assert(source.includes('captureLandingEvent'), 'PostHog event tracking preserved');
assert(source.includes('capturePostHogEvent'), 'PostHog import present');
assert(source.includes("landing_cta_clicked"), 'CTA click events tracked');

// Routing preserved
assert(source.includes('to="/login"'), 'Login route present');
assert(source.includes('to="/signup"'), 'Signup route present');

// Header functionality
assert(source.includes('setScrolled'), 'Scroll state tracking');
assert(source.includes('mobileMenuOpen'), 'Mobile menu state');
assert(source.includes('aria-label'), 'Accessibility: aria-labels on mobile menu');
assert(source.includes('aria-expanded'), 'Accessibility: aria-expanded on menu button');

// Light mode design
assert(source.includes('bg-neutral-50'), 'Light background applied');
assert(!source.includes("bg-[#0a0a0b]"), 'Old dark background removed');
assert(source.includes('dark:bg-neutral-950'), 'Dark mode support preserved');

// Typography
assert(source.includes('font-display'), 'Uses Plus Jakarta Sans font-display class');
assert(source.includes('font-extrabold'), 'Bold typography hierarchy');

// Hero copy is concrete, not vague
assert(source.includes('Upload your PDF'), 'Concrete value prop in hero');
assert(!source.includes('Next-Gen Learning Assistant'), 'Removed generic AI tagline');
assert(!source.includes('Master any subject'), 'Removed vague headline');

// Fake testimonials removed
assert(!source.includes('Alex Rivera'), 'Fake testimonial removed: Alex Rivera');
assert(!source.includes('Sarah Chen'), 'Fake testimonial removed: Sarah Chen');
assert(!source.includes('Jordan Smith'), 'Fake testimonial removed: Jordan Smith');

// Stats replace testimonials
assert(source.includes('Documents processed'), 'Stats: documents processed');
assert(source.includes('Lessons generated'), 'Stats: lessons generated');
assert(source.includes('Quiz questions created'), 'Stats: quiz questions created');

// Product mockup tells a story
assert(source.includes('Upload'), 'Mockup step 1: Upload');
assert(source.includes('Learn'), 'Mockup step 2: Learn');
assert(source.includes('Ask'), 'Mockup step 3: Ask');

// Features reduced and focused
assert(source.includes('Instant Lessons'), 'Feature: Instant Lessons');
assert(source.includes('Smart Quizzes'), 'Feature: Smart Quizzes');
assert(source.includes('AI Tutor'), 'Feature: AI Tutor');

// Pricing preserved
assert(source.includes('GHS 0'), 'Free tier pricing');
assert(source.includes('GHS 20'), 'Premium tier pricing');
assert(source.includes('Popular'), 'Popular badge on premium');

// Contact info in footer
assert(source.includes('t.me'), 'Telegram link preserved');
assert(source.includes('patrickannor35@gmail.com'), 'Email contact preserved');

// Sections reduced (no separate CTA, demo, testimonials, contact sections)
assert(!source.includes('id="demo"'), 'Removed separate demo section');
assert(!source.includes('id="testimonials"'), 'Removed testimonials section');
assert(!source.includes('id="contact"'), 'Removed separate contact section');
assert(!source.includes('Ready to ace your exams'), 'Removed redundant CTA section');

// Design system integration
assert(source.includes('shadow-card'), 'Uses design system shadow-card');
assert(source.includes('shadow-button'), 'Uses design system shadow-button');
assert(source.includes('bg-primary'), 'Uses design system primary color');

// No gradient blob backgrounds
assert(!source.includes('blur-[120px]'), 'Removed heavy blur blobs');
assert(!source.includes('blur-[150px]'), 'Removed heavy blur blobs');
assert(source.includes('bg-mesh-light'), 'Uses subtle mesh background');

// Animations
assert(source.includes('animate-fade-in-up'), 'Entrance animations present');

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
