import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const landingPage = readFileSync(resolve(projectRoot, 'src/pages/LandingPage.jsx'), 'utf-8');
const heroSection = readFileSync(resolve(projectRoot, 'src/components/blocks/hero-section.jsx'), 'utf-8');
const communitySection = readFileSync(resolve(projectRoot, 'src/components/blocks/community-section.jsx'), 'utf-8');
const testimonialsSection = readFileSync(resolve(projectRoot, 'src/components/blocks/testimonials-section.jsx'), 'utf-8');
const pricingSection = readFileSync(resolve(projectRoot, 'src/components/blocks/pricing-section.jsx'), 'utf-8');
const footer = readFileSync(resolve(projectRoot, 'src/components/blocks/footer.jsx'), 'utf-8');

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

assert(landingPage.includes('useAuth'), 'Uses useAuth hook');
assert(landingPage.includes('<Navigate to="/dashboard" replace />'), 'Redirects logged-in users to dashboard');
assert(landingPage.includes('useQuery(api.subscriptions.getPublicTopUpPricing'), 'Reads live public pricing');
assert(landingPage.includes('capturePostHogEvent'), 'Imports PostHog helper');
assert(landingPage.includes("landing_cta_clicked"), 'Tracks CTA analytics event');
assert(landingPage.includes('<HeroSection captureLandingEvent={captureLandingEvent} />'), 'Hero section receives CTA tracking');
assert(landingPage.includes('<FeatureRowsSection captureLandingEvent={captureLandingEvent} />'), 'Feature rows receive CTA tracking');
assert(/<PricingSection[\s\S]*captureLandingEvent=\{captureLandingEvent\}[\s\S]*\/>/.test(landingPage), 'Pricing section receives CTA tracking');
assert(landingPage.includes('<CtaSection captureLandingEvent={captureLandingEvent} />'), 'Final CTA section receives CTA tracking');
assert(landingPage.includes('<BlogPostModal activePost={activePost} captureLandingEvent={captureLandingEvent}'), 'Blog modal receives CTA tracking');

assert(heroSection.includes('to="/login"'), 'Hero keeps login route');
assert(heroSection.includes('to="/signup"'), 'Hero keeps signup route');
assert(heroSection.includes('onCtaClick'), 'Hero emits CTA tracking callbacks');
assert(heroSection.includes('aria-label'), 'Mobile menu keeps aria-label');
assert(heroSection.includes('aria-expanded'), 'Mobile menu keeps aria-expanded');
assert(heroSection.includes('Upload your PDF'), 'Hero value prop stays concrete');

assert(pricingSection.includes('formatPlanPrice'), 'Pricing uses localized formatter');
assert(pricingSection.includes('starterPlan.amountMajor'), 'Starter pricing is dynamic');
assert(pricingSection.includes('maxPlan.amountMajor'), 'Max pricing is dynamic');
assert(pricingSection.includes('semesterPlan.amountMajor'), 'Semester pricing is dynamic');
assert(pricingSection.includes('FIRST PURCHASE'), 'Starter badge is present');
assert(pricingSection.includes('POPULAR'), 'Popular badge is present');

assert(!communitySection.includes('/community/'), 'Community section does not reference missing /community assets');
assert(!testimonialsSection.includes('/community/'), 'Testimonials do not reference missing /community assets');

assert(existsSync(resolve(projectRoot, 'public/brand/logo.svg')), 'Standard logo asset exists');
assert(existsSync(resolve(projectRoot, 'public/brand/logo-white.svg')), 'Standard white logo asset exists');
assert(existsSync(resolve(projectRoot, 'public/brand/mark.png')), 'Standard mark asset exists');
assert(existsSync(resolve(projectRoot, 'public/brand/og-logo.png')), 'Standard social preview logo exists');
assert(!existsSync(resolve(projectRoot, 'public/logonew.jpeg')), 'Legacy logonew asset is removed');
assert(!existsSync(resolve(projectRoot, 'public/chewnpourlogo.png')), 'Legacy chewnpourlogo asset is removed');
assert(!existsSync(resolve(projectRoot, 'public/chewnpour.png')), 'Legacy chewnpour image asset is removed');
assert(landingPage.includes("import BrandLogo from '../components/BrandLogo';"), 'Landing page uses shared BrandLogo component');
assert(heroSection.includes("import BrandLogo from '../BrandLogo';"), 'Hero uses shared BrandLogo component');
assert(footer.includes("import BrandLogo from '../BrandLogo';"), 'Footer uses shared BrandLogo component');
assert(!landingPage.includes('/logonew.jpeg'), 'Landing page does not use legacy logo asset');
assert(!heroSection.includes('/logonew.jpeg'), 'Hero does not use legacy logo asset');
assert(!footer.includes('/logonew.jpeg'), 'Footer does not use legacy logo asset');
assert(!landingPage.includes('/brand/logo'), 'Landing page does not hard-code brand logo paths');
assert(!heroSection.includes('/brand/logo'), 'Hero does not hard-code brand logo paths');
assert(!footer.includes('/brand/logo'), 'Footer does not hard-code brand logo paths');
assert(existsSync(resolve(projectRoot, 'public/screenshots/app-dashboard.png')), 'Dashboard screenshot asset exists');
assert(existsSync(resolve(projectRoot, 'public/screenshots/app-assignment.png')), 'Assignment screenshot asset exists');
assert(existsSync(resolve(projectRoot, 'public/screenshots/app-community.png')), 'Community screenshot asset exists');
assert(existsSync(resolve(projectRoot, 'public/chewnpour/img1.jpg')), 'Community asset img1 exists');
assert(existsSync(resolve(projectRoot, 'public/chewnpour/img2.jpg')), 'Community asset img2 exists');
assert(existsSync(resolve(projectRoot, 'public/chewnpour/img3.jpg')), 'Community asset img3 exists');
assert(existsSync(resolve(projectRoot, 'public/chewnpour/img4.jpg')), 'Community asset img4 exists');

assert(footer.includes('mailto:info@chewnpour.com'), 'Footer keeps email contact');
assert(footer.includes('https://t.me/+jIHi6XFYdl9kNDA0'), 'Footer keeps Telegram link');
assert(!footer.includes('href="#"'), 'Footer has no placeholder links');
assert(!footer.includes('/#integration'), 'Footer removed dead integration link');
assert(!footer.includes('/#faqs'), 'Footer removed dead FAQ link');
assert(!footer.includes('/#blog'), 'Footer removed dead blog link');

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
process.exit(failed > 0 ? 1 : 0);
