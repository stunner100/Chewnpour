const DEFAULT_PRICING_CURRENCY = 'GHS';

const DEFAULT_TOP_UP_OPTIONS = [
    { id: 'starter', amountMajor: 20, credits: 5, currency: DEFAULT_PRICING_CURRENCY },
    { id: 'max', amountMajor: 40, credits: 12, currency: DEFAULT_PRICING_CURRENCY },
    { id: 'semester', amountMajor: 60, credits: 20, currency: DEFAULT_PRICING_CURRENCY, validityDays: 120, unlimitedAiChat: true },
];

const toPositiveAmount = (value, fallback = 0) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(0, parsed);
};

const stripTrailingZeros = (value) => {
    const fixed = Number(value).toFixed(2);
    return fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

export const resolvePreferredPricingCurrency = () => DEFAULT_PRICING_CURRENCY;

export const normalizeTopUpOptions = (value) => {
    if (!Array.isArray(value)) return DEFAULT_TOP_UP_OPTIONS;

    const normalized = value
        .map((item) => {
            const id = String(item?.id || '').trim();
            const amountMajor = toPositiveAmount(item?.amountMajor, 0);
            const credits = Math.max(0, Math.floor(toPositiveAmount(item?.credits, 0)));
            if (!id || amountMajor <= 0 || credits <= 0) return null;
            const plan = {
                id,
                amountMajor,
                credits,
                currency: DEFAULT_PRICING_CURRENCY,
            };
            if (item?.validityDays) plan.validityDays = item.validityDays;
            if (item?.unlimitedAiChat) plan.unlimitedAiChat = true;
            return plan;
        })
        .filter(Boolean);

    if (!normalized.length) return DEFAULT_TOP_UP_OPTIONS;
    return normalized.sort((left, right) => left.amountMajor - right.amountMajor);
};

const formatTopUpAmountForCopy = (amountMajor) =>
    `${DEFAULT_PRICING_CURRENCY} ${stripTrailingZeros(toPositiveAmount(amountMajor, 0))}`;

export const buildTopUpOptionsCopy = (topUpOptions) => {
    const options = normalizeTopUpOptions(topUpOptions);
    return options
        .map((plan) => `${formatTopUpAmountForCopy(plan.amountMajor)} (+${plan.credits} uploads)`)
        .join(' or ');
};

export const buildUploadLimitMessageFromOptions = (topUpOptions) =>
    `Upload limit reached. Choose a top-up plan: ${buildTopUpOptionsCopy(topUpOptions)}.`;

export const formatPlanPrice = (amountMajor, _currency, locale) => {
    const normalizedAmount = toPositiveAmount(amountMajor, 0);

    try {
        return new Intl.NumberFormat(locale || undefined, {
            style: 'currency',
            currency: DEFAULT_PRICING_CURRENCY,
            maximumFractionDigits: 2,
        }).format(normalizedAmount);
    } catch {
        return `${DEFAULT_PRICING_CURRENCY} ${stripTrailingZeros(normalizedAmount)}`;
    }
};
