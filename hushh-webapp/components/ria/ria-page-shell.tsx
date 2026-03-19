"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BriefcaseBusiness, ShieldCheck, TriangleAlert } from "lucide-react";

import { AppPageShell } from "@/components/app-ui/app-page-shell";
import {
  PageHeader,
  SectionHeader,
} from "@/components/app-ui/page-sections";
import {
  SurfaceCard,
  SurfaceInset,
  SurfaceStack,
  type SurfaceAccent,
  type SurfaceTone,
} from "@/components/app-ui/surfaces";
import { cn } from "@/lib/utils";

export function RiaPageShell({
  eyebrow,
  title,
  description,
  actions,
  icon = BriefcaseBusiness,
  statusPanel,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  statusPanel?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AppPageShell as="main" width="content" className={cn("pb-28", className)}>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        icon={icon}
      />

      <SurfaceStack className="mt-6">
        {statusPanel ? <div>{statusPanel}</div> : null}
        {children}
      </SurfaceStack>
    </AppPageShell>
  );
}

export function RiaSurface({
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

export function RiaCompatibilityState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        eyebrow="Compatibility Mode"
        title={title}
        description={description}
        icon={TriangleAlert}
      />
      <RiaSurface tone="warning" className="border-dashed">
        <p className="text-sm leading-6 text-muted-foreground">
          This surface is running in degraded compatibility mode until the full IAM contract is
          available in the active environment.
        </p>
      </RiaSurface>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <SurfaceInset className="p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </SurfaceInset>
  );
}

type RiaStatusTone = "neutral" | "warning" | "success" | "critical";

type RiaStatusItem = {
  label: string;
  value: string;
  helper?: string;
  tone?: RiaStatusTone;
};

const STATUS_TONE_STYLES: Record<RiaStatusTone, string> = {
  neutral: "border-border/60 bg-background/75 text-foreground",
  warning: "border-primary/20 bg-primary/6 text-foreground",
  success: "border-emerald-500/20 bg-emerald-500/8 text-foreground",
  critical: "border-red-500/20 bg-red-500/8 text-foreground",
};

export function RiaStatusPanel({
  title,
  description,
  items,
  actions,
  className,
}: {
  title: string;
  description?: string;
  items: RiaStatusItem[];
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <SectionHeader
        eyebrow="Status"
        title={title}
        description={description}
        actions={actions}
        icon={ShieldCheck}
      />
      <RiaSurface accent="sky">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <SurfaceInset
              key={`${item.label}-${item.value}`}
              className={cn(
                "p-4",
                STATUS_TONE_STYLES[item.tone || "neutral"]
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{item.value}</p>
              {item.helper ? <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p> : null}
            </SurfaceInset>
          ))}
        </div>
      </RiaSurface>
    </section>
  );
}
