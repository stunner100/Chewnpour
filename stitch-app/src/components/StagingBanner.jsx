const StagingBanner = () => (
  <div
    className="staging-banner fixed inset-x-0 top-0 z-[120] border-b border-amber-300/70 bg-[linear-gradient(90deg,rgba(120,53,15,0.96),rgba(194,65,12,0.96),rgba(146,64,14,0.96))] text-amber-50 shadow-[0_14px_40px_rgba(146,64,14,0.28)] backdrop-blur"
    role="status"
    aria-label="Staging environment notice"
  >
    <div className="mx-auto flex min-h-[var(--staging-banner-height)] max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-100/30 bg-black/20 text-base font-black tracking-[0.22em] text-amber-100">
          S
        </span>
        <div className="flex flex-col">
          <span className="text-[0.7rem] font-black uppercase tracking-[0.28em] text-amber-100/80">
            Staging Environment
          </span>
          <span className="text-sm font-semibold text-white">
            You are testing pre-production changes.
          </span>
        </div>
      </div>
      <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-amber-50/90 sm:inline-flex">
        Not production
      </span>
    </div>
  </div>
);

export default StagingBanner;
