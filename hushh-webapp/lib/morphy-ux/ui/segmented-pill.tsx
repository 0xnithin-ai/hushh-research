"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Icon } from "@/lib/morphy-ux/ui/icon";

export type SegmentedPillOption = {
  value: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
  dataTourId?: string;
};

type SegmentedPillSize = "compact" | "default";

type SegmentedPillProps = {
  value: string;
  options: SegmentedPillOption[];
  onValueChange: (value: string) => void;
  size?: SegmentedPillSize;
  className?: string;
  ariaLabel?: string;
};

const SIZE_STYLES: Record<
  SegmentedPillSize,
  {
    container: string;
    button: string;
    icon: "xs" | "sm" | "md";
    label: string;
    gap: string;
  }
> = {
  compact: {
    container: "min-h-[38px] p-1",
    button: "px-2 py-1.5 text-xs",
    icon: "sm",
    label: "text-[11px] font-medium leading-none",
    gap: "gap-1",
  },
  default: {
    container: "min-h-[45px] p-1",
    button: "px-3 py-2 text-sm",
    icon: "sm",
    label: "text-sm font-medium",
    gap: "gap-1.5",
  },
};

export const SegmentedPill = React.forwardRef<HTMLDivElement, SegmentedPillProps>(
  (
    {
      value,
      options,
      onValueChange,
      size = "default",
      className,
      ariaLabel = "Segmented selector",
    },
    ref
  ) => {
    const styles = SIZE_STYLES[size];
    const activeIndex = Math.max(
      0,
      options.findIndex((option) => option.value === value)
    );

    return (
      <div
        ref={ref}
        data-theme-control
        role="radiogroup"
        aria-label={ariaLabel}
        className={cn(
          "relative grid items-center rounded-full bg-muted/80 backdrop-blur-3xl shadow-2xl ring-1 ring-black/5 border border-white/10 dark:border-white/5",
          styles.container,
          className
        )}
        style={{
          gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        <div
          aria-hidden
          data-segment-indicator
          className="pointer-events-none absolute left-1 top-1 bottom-1 rounded-full bg-zinc-900 text-zinc-50 shadow-sm ring-1 ring-black/10 dark:bg-zinc-50 dark:text-zinc-900 dark:ring-white/20 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            width: `calc((100% - 0.5rem) / ${Math.max(options.length, 1)})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        {options.map((option) => {
          const isActive = option.value === value;
          const isDisabled = !!option.disabled;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={isDisabled}
              data-tour-id={option.dataTourId}
              disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                onValueChange(option.value);
              }}
              className={cn(
                "relative z-10 flex min-w-0 items-center justify-center rounded-full transition-[color,opacity,transform] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] disabled:cursor-not-allowed",
                styles.button,
                styles.gap,
                isActive
                  ? "text-zinc-50 dark:text-zinc-900"
                  : "text-muted-foreground hover:text-foreground",
                isDisabled && "opacity-45"
              )}
            >
              {option.icon || (typeof option.badge === "number" && option.badge > 0) ? (
                <span className="relative flex shrink-0 items-center justify-center">
                  {option.icon ? (
                    <Icon
                      icon={option.icon}
                      size={styles.icon}
                      className={cn(
                        "transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                        isActive && "scale-105"
                      )}
                    />
                  ) : null}
                  {typeof option.badge === "number" && option.badge > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full border border-background bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                      {option.badge > 9 ? "9+" : option.badge}
                    </span>
                  ) : null}
                </span>
              ) : null}
              <span className={cn("whitespace-nowrap", styles.label)}>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }
);

SegmentedPill.displayName = "SegmentedPill";
