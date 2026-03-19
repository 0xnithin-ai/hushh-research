"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { SurfaceCard, type SurfaceAccent, type SurfaceTone } from "@/components/app-ui/surfaces";
import { Icon } from "@/lib/morphy-ux/ui";
import { cn } from "@/lib/utils";

type SectionAccent =
  | "default"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet";

const ACCENT_STYLES: Record<SectionAccent, {
  eyebrow: string;
  icon: string;
  divider: string;
}> = {
  default: {
    eyebrow: "text-muted-foreground/88",
    icon: "border-border/70 bg-background/90 text-foreground shadow-[0_18px_38px_-28px_rgba(15,23,42,0.24)] dark:shadow-[0_22px_40px_-30px_rgba(0,0,0,0.5)]",
    divider: "from-border via-border/78 to-transparent",
  },
  sky: {
    eyebrow: "text-sky-700/90 dark:text-sky-300/90",
    icon: "border-sky-200/80 bg-sky-500/[0.08] text-sky-700 shadow-[0_18px_38px_-28px_rgba(56,189,248,0.38)] dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200 dark:shadow-[0_22px_40px_-28px_rgba(56,189,248,0.22)]",
    divider: "from-sky-300/90 via-sky-200/55 to-transparent dark:from-sky-400/50 dark:via-sky-400/18",
  },
  emerald: {
    eyebrow: "text-emerald-700/90 dark:text-emerald-300/90",
    icon: "border-emerald-200/80 bg-emerald-500/[0.08] text-emerald-700 shadow-[0_18px_38px_-28px_rgba(16,185,129,0.34)] dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200 dark:shadow-[0_22px_40px_-28px_rgba(16,185,129,0.22)]",
    divider: "from-emerald-300/88 via-emerald-200/52 to-transparent dark:from-emerald-400/48 dark:via-emerald-400/18",
  },
  amber: {
    eyebrow: "text-amber-700/92 dark:text-amber-300/92",
    icon: "border-amber-200/80 bg-amber-500/[0.08] text-amber-700 shadow-[0_18px_38px_-28px_rgba(245,158,11,0.34)] dark:border-amber-400/22 dark:bg-amber-400/10 dark:text-amber-200 dark:shadow-[0_22px_40px_-28px_rgba(245,158,11,0.22)]",
    divider: "from-amber-300/88 via-amber-200/52 to-transparent dark:from-amber-400/48 dark:via-amber-400/18",
  },
  rose: {
    eyebrow: "text-rose-700/90 dark:text-rose-300/90",
    icon: "border-rose-200/80 bg-rose-500/[0.08] text-rose-700 shadow-[0_18px_38px_-28px_rgba(244,63,94,0.34)] dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 dark:shadow-[0_22px_40px_-28px_rgba(244,63,94,0.22)]",
    divider: "from-rose-300/88 via-rose-200/52 to-transparent dark:from-rose-400/48 dark:via-rose-400/18",
  },
  violet: {
    eyebrow: "text-violet-700/90 dark:text-violet-300/90",
    icon: "border-violet-200/80 bg-violet-500/[0.08] text-violet-700 shadow-[0_18px_38px_-28px_rgba(139,92,246,0.34)] dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200 dark:shadow-[0_22px_40px_-28px_rgba(139,92,246,0.22)]",
    divider: "from-violet-300/88 via-violet-200/52 to-transparent dark:from-violet-400/48 dark:via-violet-400/18",
  },
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  accent = "default",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  accent?: SectionAccent;
  className?: string;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <header className={cn("space-y-[var(--page-header-stack-gap)]", className)}>
      <div className="flex flex-col gap-[var(--page-header-row-gap)] lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-start gap-4 sm:gap-5">
            {icon ? (
              <span
                className={cn(
                  "inline-flex h-12 w-12 shrink-0 self-center items-center justify-center rounded-[22px] border sm:h-14 sm:w-14",
                  styles.icon
                )}
              >
                <Icon icon={icon} size="lg" />
              </span>
            ) : null}
            <div className="min-w-0 space-y-[var(--page-header-copy-gap)]">
              {eyebrow ? (
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.3em]",
                    styles.eyebrow
                  )}
                >
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-[clamp(2.05rem,4.7vw,2.95rem)] font-semibold tracking-tight leading-[1.02] text-foreground">
                {title}
              </h1>
              {description ? (
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-[var(--page-header-actions-gap)]">{actions}</div> : null}
      </div>
      <div
        className={cn(
          "h-px w-full bg-gradient-to-r",
          styles.divider
        )}
      />
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  accent = "default",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  accent?: SectionAccent;
  className?: string;
}) {
  const styles = ACCENT_STYLES[accent];
  return (
    <div className={cn("space-y-[var(--section-header-stack-gap)]", className)}>
      <div className="flex flex-col gap-[var(--section-header-row-gap)] sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3 sm:gap-4">
            {icon ? (
              <span
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 self-center items-center justify-center rounded-[18px] border sm:h-11 sm:w-11",
                  styles.icon
                )}
              >
                <Icon icon={icon} size="md" />
              </span>
            ) : null}
            <div className="min-w-0 space-y-[var(--section-header-copy-gap)]">
              {eyebrow ? (
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-[0.24em]",
                    styles.eyebrow
                  )}
                >
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="text-lg font-semibold tracking-tight leading-[1.08] text-foreground sm:text-xl">
                {title}
              </h2>
              {description ? (
                <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-[var(--section-header-actions-gap)]">{actions}</div> : null}
      </div>
      <div
        className={cn(
          "h-px w-full bg-gradient-to-r",
          styles.divider
        )}
      />
    </div>
  );
}

export function ContentSurface({
  children,
  className,
  accent = "none",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  accent?: SurfaceAccent;
  tone?: SurfaceTone;
}) {
  return (
    <SurfaceCard tone={tone} accent={accent} className={className}>
      {children}
    </SurfaceCard>
  );
}
