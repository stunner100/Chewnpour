import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const landingPage = readFileSync(resolve(projectRoot, 'src/pages/LandingPage.jsx'), 'utf-8');
const studentDashboard = readFileSync(resolve(projectRoot, 'src/pages/StudentDashboard.jsx'), 'utf-8');
const dashboardLayout = readFileSync(resolve(projectRoot, 'src/components/DashboardLayout.jsx'), 'utf-8');

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

console.log('--- Landing + dashboard Slate redesign regression ---\n');

assert(landingPage.includes('useAuth'), 'Uses useAuth hook');
assert(landingPage.includes('<Navigate to="/dashboard" replace />'), 'Redirects logged-in users to dashboard');
assert(!landingPage.includes("from 'convex/react'"), 'Landing page is Convex-free');
assert(landingPage.includes('normalizeTopUpOptions'), 'Uses static top-up catalog helpers');
assert(landingPage.includes("amountMajor: 20"), 'Starter plan pricing stays GHS 20');
assert(landingPage.includes('capturePostHogEvent'), 'Imports PostHog helper');
assert(landingPage.includes("landing_cta_clicked"), 'Tracks CTA analytics event');
assert(landingPage.includes('<HeroSection captureLandingEvent={captureLandingEvent} />'), 'Hero section receives CTA tracking');
assert(landingPage.includes('<PricingSection'), 'Pricing section is rendered');
assert(landingPage.includes('<CtaSection captureLandingEvent={captureLandingEvent} />'), 'Final CTA section receives CTA tracking');
assert(landingPage.includes('Start free'), 'Bottom CTA uses Start free');
assert(landingPage.includes('Free Plan'), 'Free plan card present');
assert(landingPage.includes('Basic Plan'), 'Basic plan card present');
assert(landingPage.includes('Pro Plan'), 'Pro plan card present');
assert(landingPage.includes("to=\"/signup\""), 'Signup routes preserved');
assert(landingPage.includes("to=\"/login\""), 'Login route preserved');
assert(landingPage.includes('aria-expanded'), 'Mobile menu keeps aria-expanded');
assert(landingPage.includes('slate-root'), 'Uses Slate light root class');
assert(landingPage.includes('/redesign/product-mockup'), 'Uses redesign product mockup asset');
assert(landingPage.includes("import BrandLogo from '../components/BrandLogo';"), 'Landing page uses shared BrandLogo component');
assert(!landingPage.includes('/logonew.jpeg'), 'Landing page does not use legacy logo asset');
assert(!landingPage.includes("rgb(16, 17, 18)"), 'Dark landing palette removed');

assert(existsSync(resolve(projectRoot, 'public/brand/logo.svg')), 'Standard logo asset exists');
assert(existsSync(resolve(projectRoot, 'public/brand/logo-white.svg')), 'Standard white logo asset exists');
assert(existsSync(resolve(projectRoot, 'public/redesign/product-mockup.avif')), 'Redesign AVIF mockup exists');
assert(existsSync(resolve(projectRoot, 'public/redesign/product-mockup.jpg')), 'Redesign JPG mockup fallback exists');

assert(studentDashboard.includes('Continue studying'), 'Dashboard continue CTA present');
assert(studentDashboard.includes('Upload material'), 'Dashboard upload card present');
assert(studentDashboard.includes('Recent materials'), 'Dashboard recent materials present');
assert(studentDashboard.includes('rounded-[24px]'), 'Dashboard uses Slate large radii');
assert(dashboardLayout.includes('rounded-full bg-surface-soft'), 'Dashboard search uses pill shape');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
