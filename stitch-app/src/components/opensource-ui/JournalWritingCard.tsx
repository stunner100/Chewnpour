import {
  forwardRef,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
} from "react";

import { cn } from "@/lib/utils";
import { Signature } from "lucide-react";

export type JournalWritingCardProps = Readonly<
  {
    title?: string;
    date?: string;
    placeholder?: string;
    defaultText?: string;
    onChange?: (text: string) => void;
  } & ComponentPropsWithoutRef<"div">
>;

// Production-ready Journal Writing component — styled with Tailwind CSS.
export const JournalWritingCard = forwardRef<
  HTMLDivElement,
  JournalWritingCardProps
>(
  (
    {
      className,
      title = "Morning pages",
      date = "Saturday, Jun 6",
      placeholder = "Write freely. No edits, no judgment…",
      defaultText = "",
      onChange,
      ...props
    },
    ref,
  ) => {
    const [text, setText] = useState(defaultText);
    const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    useEffect(() => {
      if (!text) {
        setSaveState("saved");
        return;
      }

      setSaveState("saving");
      const timer = globalThis.setTimeout(() => setSaveState("saved"), 900);
      return () => globalThis.clearTimeout(timer);
    }, [text]);

    return (
      <div
        ref={ref}
        data-slot="journal-writing-card"
        className={cn(
          "w-72 overflow-hidden rounded-2xl border border-border-subtle bg-surface font-sans shadow-lg",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle bg-[#f6f2eb] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm leading-tight font-semibold text-text-primary">
              {title}
            </p>
            <p className="mt-0.5 text-[10px] leading-none text-text-primary">
              {date}
            </p>
          </div>
          <Signature size={14} className="mt-0.5 shrink-0 text-text-primary" />
        </div>

        <div
          className="relative min-h-[12.5rem] bg-surface"
          style={{
            backgroundImage:
              "repeating-linear-gradient(transparent, transparent 27px, #f0f0f0 27px, #f0f0f0 28px)",
            backgroundPosition: "0 12px",
          }}
        >
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange?.(e.target.value);
            }}
            placeholder={placeholder}
            aria-label="Journal entry"
            data-slot="journal-writing-card-input"
            className="relative z-10 h-[12.5rem] w-full resize-none scrollbar-none bg-transparent px-4 pt-3 pb-2 font-display text-[14px] leading-7 text-text-primary outline-none [-ms-overflow-style:none] placeholder:text-text-muted [&::-webkit-scrollbar]:hidden"
          />
          <div className="absolute top-0 left-3 h-full w-px bg-rose-200/80" />
        </div>

        <div className="flex h-9 items-center justify-between border-t border-border-subtle px-4">
          <span className="text-[10px] leading-none text-text-muted">
            {words} words
          </span>
          <div
            className="flex h-4 items-center justify-end gap-1.5"
            aria-live="polite"
            aria-label={saveState === "saving" ? "Saving" : "Saved"}
          >
            {saveState === "saving" && (
              <span className="text-[10px] leading-none text-text-muted">
                Saving…
              </span>
            )}
            <span className="relative inline-flex h-2 w-2 shrink-0">
              {saveState === "saving" ? (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </>
              ) : (
                <span className="inline-flex h-2 w-2 rounded-full bg-success" />
              )}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

JournalWritingCard.displayName = "JournalWritingCard";
