import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = await fs.readFile(path.join(root, 'src', 'lib', 'pricingCurrency.js'), 'utf8');

for (const pattern of [
  "const DEFAULT_PRICING_CURRENCY = 'GHS';",
  'export const resolvePreferredPricingCurrency = () => DEFAULT_PRICING_CURRENCY;',
  'currency: DEFAULT_PRICING_CURRENCY,',
  'currency: DEFAULT_PRICING_CURRENCY',
]) {
  if (!source.includes(pattern)) {
    throw new Error(`Expected pricingCurrency.js to include "${pattern}" for GHS-only pricing.`);
  }
}

for (const disallowedPattern of [
  'TIME_ZONE_TO_CURRENCY',
  'REGION_TO_CURRENCY',
  'resolveCurrencyFromTimeZone',
  'resolveCurrencyFromRegion',
]) {
  if (source.includes(disallowedPattern)) {
    throw new Error(`Currency cutover regression: found stale multi-currency path "${disallowedPattern}".`);
  }
}

console.log('pricing-currency-timezone-regression.test.mjs passed (GHS-only)');
