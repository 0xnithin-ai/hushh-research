"use client";

import { ExternalLink } from "lucide-react";

import { Card, CardContent } from "@/lib/morphy-ux/card";
import type { KaiHomeNewsItem } from "@/lib/services/api-service";

interface NewsTapeProps {
  rows: KaiHomeNewsItem[];
}

function formatPublished(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NewsTape({ rows }: NewsTapeProps) {
  if (!rows.length) {
    return (
      <Card variant="muted" effect="fill" className="rounded-xl p-0">
        <CardContent className="p-4 text-sm text-muted-foreground">
          No recent market headlines are available right now.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto overflow-y-visible px-8 py-4">
      <div className="flex min-w-0 gap-3">
        {rows.slice(0, 8).map((row, index) => (
          <a
            key={`${row.symbol}-${index}-${row.url}`}
            href={row.url}
            target="_blank"
            rel="noreferrer"
            className="w-[260px] shrink-0"
          >
            <Card
              variant="none"
              effect="glass"
              className="h-full rounded-xl p-0 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
            >
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {row.symbol}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="line-clamp-3 text-sm font-semibold leading-snug">{row.title}</p>
                <div className="text-[11px] text-muted-foreground">
                  <p>{row.source_name}</p>
                  <p>{formatPublished(row.published_at)}</p>
                </div>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
