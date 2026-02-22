"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/lib/morphy-ux/button";
import { cn } from "@/lib/utils";

const DASHBOARD_ROUTE_TABS = [
  { id: "overview", label: "Overview", href: "/kai/dashboard" },
  { id: "analysis", label: "Analysis", href: "/kai/dashboard/analysis?tab=history" },
  { id: "optimize", label: "Optimize", href: "/kai/dashboard/portfolio-health" },
] as const;

function activeTabFromPath(pathname: string): (typeof DASHBOARD_ROUTE_TABS)[number]["id"] {
  if (pathname.startsWith("/kai/dashboard/analysis")) return "analysis";
  if (pathname.startsWith("/kai/dashboard/portfolio-health")) return "optimize";
  return "overview";
}

export function DashboardRouteTabs() {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = useMemo(() => activeTabFromPath(pathname || "/kai/dashboard"), [pathname]);

  return (
    <div className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-3 sm:px-6">
        <div className="inline-flex rounded-full border border-border/60 bg-background/80 p-1 shadow-sm">
          {DASHBOARD_ROUTE_TABS.map((tab) => (
            <Button
              key={tab.id}
              variant="none"
              effect={activeTab === tab.id ? "fill" : "fade"}
              size="sm"
              onClick={() => router.push(tab.href)}
              className={cn(
                "rounded-full px-4 sm:px-5",
                activeTab === tab.id ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

