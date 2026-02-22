"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { SegmentedPill, type SegmentedPillOption } from "@/lib/morphy-ux/ui";
import { useKaiBottomChromeVisibility } from "@/lib/navigation/kai-bottom-chrome-visibility";
import { cn } from "@/lib/utils";

const DASHBOARD_ROUTE_TABS = [
  { id: "market", label: "Market", href: "/kai", prefetchHref: "/kai" },
  { id: "dashboard", label: "Dashboard", href: "/kai/dashboard", prefetchHref: "/kai/dashboard" },
  { id: "analysis", label: "Analysis", href: "/kai/analysis?tab=history", prefetchHref: "/kai/analysis" },
] as const;

function activeTabFromPath(pathname: string): (typeof DASHBOARD_ROUTE_TABS)[number]["id"] {
  if (pathname === "/kai" || pathname.startsWith("/kai?")) return "market";
  if (pathname.startsWith("/kai/analysis") || pathname.startsWith("/kai/dashboard/analysis")) {
    return "analysis";
  }
  if (pathname.startsWith("/kai/dashboard") || pathname.startsWith("/kai/optimize")) {
    return "dashboard";
  }
  return "market";
}

export function DashboardRouteTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hideTabsForPath =
    pathname.startsWith("/kai/onboarding") || pathname.startsWith("/kai/import");
  const [mounted, setMounted] = useState(false);
  const { hidden: hideRouteTabs } = useKaiBottomChromeVisibility(!hideTabsForPath);

  const activeTab = useMemo(() => activeTabFromPath(pathname || "/kai"), [pathname]);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    for (const tab of DASHBOARD_ROUTE_TABS) {
      router.prefetch(tab.prefetchHref);
    }
  }, [mounted, router]);

  const activeTabIndex = useMemo(
    () => DASHBOARD_ROUTE_TABS.findIndex((tab) => tab.id === activeTab),
    [activeTab]
  );
  const tabOptions = useMemo<SegmentedPillOption[]>(
    () =>
      DASHBOARD_ROUTE_TABS.map((tab) => ({
        value: tab.id,
        label: tab.label,
      })),
    []
  );

  const handleTabChange = useCallback(
    (nextTab: string) => {
      const target = DASHBOARD_ROUTE_TABS.find((tab) => tab.id === nextTab);
      if (!target || target.id === activeTab) return;
      router.push(target.href);
    },
    [activeTab, router]
  );

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      if (!touch || startX === null || startY === null) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) < 48 || Math.abs(deltaY) > 36) return;

      const nextIndex = deltaX < 0 ? activeTabIndex + 1 : activeTabIndex - 1;
      const target = DASHBOARD_ROUTE_TABS[nextIndex];
      if (!target) return;
      router.push(target.href);
    },
    [activeTabIndex, router]
  );

  if (!mounted || typeof document === "undefined" || hideTabsForPath) {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[90]"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 58px)" }}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 -top-4 h-[90px] top-bar-glass transform-gpu transition-all duration-300 ease-out will-change-transform",
          hideRouteTabs ? "opacity-0" : "opacity-100"
        )}
        style={{
          transform: hideRouteTabs
            ? "translate3d(0, calc(-100% - 10px), 0)"
            : "translate3d(0, 0, 0)",
        }}
      />
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-6xl justify-center px-4 transform-gpu transition-all duration-300 ease-out will-change-transform sm:px-6",
          hideRouteTabs
            ? "pointer-events-none opacity-0"
            : "pointer-events-auto opacity-100"
        )}
        style={{
          transform: hideRouteTabs
            ? "translate3d(0, calc(-100% - 10px), 0)"
            : "translate3d(0, 0, 0)",
        }}
      >
        <div
          className="pointer-events-auto w-full max-w-[460px] touch-pan-x"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <SegmentedPill
            size="compact"
            value={activeTab}
            options={tabOptions}
            onValueChange={handleTabChange}
            ariaLabel="Kai route tabs"
            className="w-full"
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
