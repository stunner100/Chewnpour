import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

export type InkStampDocumentCardProps = Readonly<
  {
    title?: string;
    reference?: string;
    submittedBy?: string;
    submittedOn?: string;
    stampLabel?: string;
    status?: string;
  } & ComponentPropsWithoutRef<"div">
>;

export const InkStampDocumentCard = forwardRef<
  HTMLDivElement,
  InkStampDocumentCardProps
>(
  (
    {
      className,
      title = "Vendor Agreement",
      reference = "DOC-2026-118",
      submittedBy = "Northline Studio",
      submittedOn = "12 Jun 2026",
      stampLabel = "Approved",
      status = "Signed & filed",
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        data-slot="ink-stamp-document-card"
        className={cn(
          "relative w-80 overflow-hidden rounded-xl border border-border-subtle bg-[#fffef9] p-5 font-sans shadow-96",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.18em] text-text-muted uppercase">
              {reference}
            </p>
            <h3 className="mt-2 text-base font-semibold text-text-primary">{title}</h3>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-secondary">
            <FileText size={16} aria-hidden />
          </div>
        </div>

        <div className="mt-4 space-y-2 text-xs text-text-secondary">
          <p>
            <span className="text-text-muted">Submitted by</span> · {submittedBy}
          </p>
          <p>
            <span className="text-text-muted">Date</span> · {submittedOn}
          </p>
        </div>

        <div className="mt-5 h-px bg-neutral-200" />

        <p className="mt-4 text-xs text-text-secondary">{status}</p>

        <div
          data-layer="ink-stamp"
          className="pointer-events-none absolute right-4 bottom-4 -rotate-12 rounded-md border-2 border-rose-500 px-3 py-1.5 text-center"
          aria-hidden
        >
          <p className="text-[10px] font-bold tracking-[0.28em] text-error uppercase">
            {stampLabel}
          </p>
        </div>
      </div>
    );
  },
);

InkStampDocumentCard.displayName = "InkStampDocumentCard";
