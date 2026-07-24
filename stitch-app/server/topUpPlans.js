export const TOPUP_CURRENCY = "GHS";

export const TOPUP_PLANS = [
    {
        id: "starter",
        amountMajor: 20,
        amountMinor: 2000,
        credits: 5,
    },
    {
        id: "max",
        amountMajor: 40,
        amountMinor: 4000,
        credits: 12,
    },
    {
        id: "semester",
        amountMajor: 60,
        amountMinor: 6000,
        credits: 20,
        validityDays: 120,
        unlimitedAiChat: true,
    },
];

export const FIRST_TIME_STARTER_PLAN = {
    id: "first-time-starter",
    amountMajor: 15,
    amountMinor: 1500,
    credits: 5,
};

const toClientPlan = (plan) => ({
    id: plan.id,
    amountMajor: plan.amountMajor,
    amountMinor: plan.amountMinor,
    credits: plan.credits,
    currency: TOPUP_CURRENCY,
    ...(plan.validityDays ? { validityDays: plan.validityDays } : {}),
    ...(plan.unlimitedAiChat ? { unlimitedAiChat: true } : {}),
});

export const listTopUpPlans = ({ includeFirstTime = false } = {}) => {
    const plans = [];
    if (includeFirstTime) {
        plans.push(toClientPlan(FIRST_TIME_STARTER_PLAN));
    }
    for (const plan of TOPUP_PLANS) {
        plans.push(toClientPlan(plan));
    }
    return plans;
};

export const resolveTopUpPlanById = (planId) => {
    const normalizedId = String(planId || "").trim().toLowerCase();
    if (!normalizedId) return null;
    if (normalizedId === FIRST_TIME_STARTER_PLAN.id) {
        return toClientPlan(FIRST_TIME_STARTER_PLAN);
    }
    const plan = TOPUP_PLANS.find((item) => item.id === normalizedId);
    return plan ? toClientPlan(plan) : null;
};

export const resolveTopUpPlanByPayment = (amountMinor, currency) => {
    const normalizedAmount = Math.max(0, Math.floor(Number(amountMinor) || 0));
    const normalizedCurrency = String(currency || "").trim().toUpperCase();
    if (normalizedCurrency !== TOPUP_CURRENCY || normalizedAmount <= 0) {
        return null;
    }
    if (FIRST_TIME_STARTER_PLAN.amountMinor === normalizedAmount) {
        return toClientPlan(FIRST_TIME_STARTER_PLAN);
    }
    const plan = TOPUP_PLANS.find((item) => item.amountMinor === normalizedAmount);
    return plan ? toClientPlan(plan) : null;
};
