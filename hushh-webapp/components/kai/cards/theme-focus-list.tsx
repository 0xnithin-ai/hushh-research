"use client";

import { ChevronRight, Cpu, Percent, Zap, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/lib/morphy-ux/card";
import { Icon } from "@/lib/morphy-ux/ui";

export interface ThemeFocusItem {
  id?: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

const FALLBACK_ICON: LucideIcon[] = [Cpu, Percent, Zap];

export function ThemeFocusList({ themes = [] }: { themes?: ThemeFocusItem[] }) {
  if (!themes.length) {
    return (
      <Card variant="muted" effect="fill" className="rounded-xl p-0">
        <CardContent className="p-4 text-sm text-muted-foreground">
          No active market themes are available right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {themes.map((theme, idx) => (
        <Card key={theme.id || theme.title} variant="none" effect="glass" className="rounded-xl p-0">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-background/80">
              <Icon icon={theme.icon || FALLBACK_ICON[idx % FALLBACK_ICON.length] || Cpu} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{theme.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{theme.subtitle}</p>
            </div>
            <Icon icon={ChevronRight} size="sm" className="text-muted-foreground" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
