import {
  forwardRef,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
} from "react";

import { Mic, Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

const WAVEFORM_BAR_COUNT = 16;
const WAVEFORM_BAR_IDS = Array.from(
  { length: WAVEFORM_BAR_COUNT },
  (_, bar) => bar,
);
const IDLE_BAR_HEIGHT = 12;
const RESTING_BAR_HEIGHT = 20;

export type VoiceAssistantLayout = "card" | "inline";
export type VoiceAssistantAppearance = "mic" | "playback";

export type VoiceAssistantWidgetProps = Readonly<
  {
    label?: string;
    idleLabel?: string;
    title?: string;
    active?: boolean;
    layout?: VoiceAssistantLayout;
    appearance?: VoiceAssistantAppearance;
    showButton?: boolean;
    onToggle?: () => void;
    onActiveChange?: (active: boolean) => void;
  } & ComponentPropsWithoutRef<"div">
>;

function layoutClassName(layout: VoiceAssistantLayout) {
  switch (layout) {
    case "card":
      return "h-44 w-44 flex-col justify-between p-4 shadow-sm";
    case "inline":
      return "h-11 w-full max-w-full flex-row justify-start gap-3 px-3 py-1.5";
    default: {
      const _exhaustive: never = layout;
      return _exhaustive;
    }
  }
}

function WaveformBars({
  active,
  levels,
  compact,
}: Readonly<{
  active: boolean;
  levels: number[];
  compact: boolean;
}>) {
  return (
    <div
      className={cn(
        "flex items-end justify-center gap-0.5",
        compact ? "h-6 w-20 shrink-0" : "h-10",
      )}
      aria-hidden
    >
      {WAVEFORM_BAR_IDS.map((bar) => (
        <span
          key={bar}
          className={cn(
            "w-1 rounded-full transition-all duration-100",
            active ? "bg-primary" : "bg-border-default",
          )}
          style={{ height: `${levels[bar]}%` }}
        />
      ))}
    </div>
  );
}

export const VoiceAssistantWidget = forwardRef<
  HTMLDivElement,
  VoiceAssistantWidgetProps
>(
  (
    {
      className,
      label = "Listening…",
      idleLabel = "Tap to speak",
      title = "Voice AI",
      active: activeProp,
      layout = "card",
      appearance = "mic",
      showButton = true,
      onToggle,
      onActiveChange,
      ...props
    },
    ref,
  ) => {
    const isControlled = activeProp !== undefined;
    const [uncontrolledActive, setUncontrolledActive] = useState(false);
    const active = isControlled ? Boolean(activeProp) : uncontrolledActive;
    const [levels, setLevels] = useState<number[]>(() =>
      WAVEFORM_BAR_IDS.map(() => RESTING_BAR_HEIGHT),
    );
    const compact = layout === "inline";

    useEffect(() => {
      if (!active) {
        setLevels(WAVEFORM_BAR_IDS.map(() => IDLE_BAR_HEIGHT));
        return undefined;
      }

      const timer = globalThis.setInterval(() => {
        setLevels(WAVEFORM_BAR_IDS.map(() => 15 + Math.random() * 55));
      }, 100);

      return () => globalThis.clearInterval(timer);
    }, [active]);

    const handleToggle = () => {
      if (onToggle) {
        onToggle();
        return;
      }
      const next = !active;
      if (!isControlled) setUncontrolledActive(next);
      onActiveChange?.(next);
    };

    const caption = active ? label : idleLabel;

    const pressedLabel = (() => {
      switch (appearance) {
        case "playback":
          return active ? "Pause reading" : "Play lesson audio";
        case "mic":
          return active ? "Stop listening" : "Start listening";
        default: {
          const _exhaustive: never = appearance;
          return _exhaustive;
        }
      }
    })();

    return (
      <div
        ref={ref}
        data-slot="voice-assistant-widget"
        data-layout={layout}
        data-active={active ? "true" : "false"}
        className={cn(
          "flex items-center overflow-hidden rounded-3xl border border-border-subtle bg-surface font-sans select-none",
          layoutClassName(layout),
          className,
        )}
        {...props}
      >
        {compact ? null : (
          <p className="text-[10px] font-semibold tracking-widest text-text-muted uppercase">
            {title}
          </p>
        )}

        <WaveformBars active={active} compact={compact} levels={levels} />

        {showButton ? (
          <button
            type="button"
            onClick={handleToggle}
            aria-label={pressedLabel}
            aria-pressed={active}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-full text-white transition-colors active:scale-95",
              compact ? "size-8 shrink-0" : "size-12",
              active
                ? appearance === "playback"
                  ? "bg-primary"
                  : "bg-error"
                : "bg-text-primary",
            )}
          >
            {appearance === "playback" ? (
              active ? (
                <Pause size={compact ? 14 : 18} fill="currentColor" />
              ) : (
                <Play size={compact ? 14 : 18} fill="currentColor" />
              )
            ) : (
              <Mic size={compact ? 14 : 18} />
            )}
          </button>
        ) : null}

        {caption ? (
          <p
            className={cn(
              "font-normal text-text-secondary",
              compact
                ? "min-w-0 flex-1 truncate text-caption"
                : "text-[11px]",
            )}
          >
            {caption}
          </p>
        ) : null}
      </div>
    );
  },
);

VoiceAssistantWidget.displayName = "VoiceAssistantWidget";
