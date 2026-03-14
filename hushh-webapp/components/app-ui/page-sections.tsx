"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Icon } from "@/lib/morphy-ux/ui";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <header className={cn("space-y-4", className)}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary/80">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <Icon icon={icon} size="md" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <Icon icon={icon} size="sm" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {title}
              </h2>
              {description ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function ContentSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] bg-transparent p-0 shadow-none backdrop-blur-none",
        className
      )}
    >
      {children}
    </section>
  );
}
