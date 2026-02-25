"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

import { SegmentedPill, type SegmentedPillOption } from "@/lib/morphy-ux/ui";
import { useKaiBottomChromeVisibility } from "@/lib/navigation/kai-bottom-chrome-visibility";
import {
  activeKaiRouteTabFromPath,
  KAI_ROUTE_TABS,
} from "@/lib/navigation/kai-route-tabs";
import { ROUTES } from "@/lib/navigation/routes";
import { cn } from "@/lib/utils";
import { scrollAppToTop } from "@/lib/navigation/use-scroll-reset";

const SWIPE_VERTICAL_LIMIT_PX = 48;
const SWIPE_DIRECTION_RATIO = 1.35;
const SWIPE_DRAG_RESISTANCE = 1;
const SEGMENTED_PILL_HORIZONTAL_INSET_PX = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hasHorizontalScrollParent(target: HTMLElement | null): boolean {
  if (!target || typeof window === "undefined") return false;
  let node: HTMLElement | null = target;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    const canScroll =
      (overflowX === "auto" || overflowX === "scroll") && node.scrollWidth > node.clientWidth + 4;
    if (canScroll) return true;
    node = node.parentElement;
  }
  return false;
}

function shouldIgnoreGlobalSwipeTarget(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;

  if (
    element.closest(
      'input, textarea, select, button, a, [role="button"], [contenteditable="true"], [data-no-route-swipe]'
    )
  ) {
    return true;
  }

  if (element.closest('[data-slot="carousel"], [data-slot="carousel-content"], [data-slot="carousel-item"]')) {
    return true;
  }

  if (hasHorizontalScrollParent(element)) {
    return true;
  }

  return false;
}

export function DashboardRouteTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const segmentedPillRef = useRef<HTMLDivElement | null>(null);
  const hideTabsForPath =
    pathname.startsWith(ROUTES.KAI_ONBOARDING) || pathname.startsWith(ROUTES.KAI_IMPORT);
  const [mounted, setMounted] = useState(false);
  const { hidden: hideRouteTabs } = useKaiBottomChromeVisibility(!hideTabsForPath);

  const activeTab = useMemo(
    () => activeKaiRouteTabFromPath(pathname || ROUTES.KAI_HOME),
    [pathname]
  );
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    for (const tab of KAI_ROUTE_TABS) {
      router.prefetch(tab.prefetchHref);
    }
  }, [mounted, router]);
  const tabOptions = useMemo<SegmentedPillOption[]>(
    () =>
      KAI_ROUTE_TABS.map((tab) => ({
        value: tab.id,
        label: tab.label,
      })),
    []
  );

  const handleTabChange = useCallback(
    (nextTab: string) => {
      const target = KAI_ROUTE_TABS.find((tab) => tab.id === nextTab);
      if (!target || target.id === activeTab) return;
      scrollAppToTop("auto");
      // Match bottom-navbar tap motion: rely on SegmentedPill native transition.
      const root = segmentedPillRef.current;
      const indicator = root?.querySelector<HTMLElement>("[data-segment-indicator]") ?? null;
      if (indicator) {
        indicator.style.transition = "";
      }
      if (root) {
        root.style.setProperty("--segment-drag-x", "0px");
      }
      router.push(target.href);
    },
    [activeTab, router]
  );

  useEffect(() => {
    if (!mounted || hideTabsForPath || typeof document === "undefined") {
      return;
    }
    const tabRoot = segmentedPillRef.current;
    if (!tabRoot) {
      return;
    }

    let routePushTimeout: number | null = null;

    let startX: number | null = null;
    let startY: number | null = null;
    let activeGesture = false;
    let gestureAxis: "undecided" | "horizontal" | "vertical" = "undecided";
    let ignoredTarget = false;
    let currentOffsetPx = 0;
    let gestureSegmentWidth = 0;
    let gestureMinOffset = 0;
    let gestureMaxOffset = 0;
    const activeIndex = Math.max(
      0,
      KAI_ROUTE_TABS.findIndex((tab) => tab.id === activeTab)
    );

    const getSegmentMetrics = () => {
      const root = segmentedPillRef.current;
      if (!root) {
        return { segmentWidth: 1, minOffset: 0, maxOffset: 0 };
      }
      const totalWidth = root.getBoundingClientRect().width;
      const segmentWidth = Math.max(
        1,
        (totalWidth - SEGMENTED_PILL_HORIZONTAL_INSET_PX) / Math.max(KAI_ROUTE_TABS.length, 1)
      );
      const minOffset = -activeIndex * segmentWidth;
      const maxOffset = (KAI_ROUTE_TABS.length - 1 - activeIndex) * segmentWidth;
      return {
        segmentWidth,
        minOffset,
        maxOffset,
      };
    };

    const setIndicatorOffset = (
      x: number,
      {
        immediate = false,
        durationMs = 220,
      }: {
        immediate?: boolean;
        durationMs?: number;
      } = {}
    ) => {
      const root = segmentedPillRef.current;
      const indicator = root?.querySelector<HTMLElement>("[data-segment-indicator]") ?? null;
      if (!root || !indicator) return;
      if (immediate) {
        indicator.style.transition = "none";
      } else {
        indicator.style.transition = `transform ${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      }
      root.style.setProperty("--segment-drag-x", `${x}px`);
    };

    const resetIndicatorOffset = (immediate = false) => {
      setIndicatorOffset(0, { immediate, durationMs: 220 });
    };

    const resetGesture = () => {
      startX = null;
      startY = null;
      activeGesture = false;
      gestureAxis = "undecided";
      ignoredTarget = false;
      currentOffsetPx = 0;
      gestureSegmentWidth = 0;
      gestureMinOffset = 0;
      gestureMaxOffset = 0;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        resetGesture();
        return;
      }
      ignoredTarget = shouldIgnoreGlobalSwipeTarget(event.target);
      if (ignoredTarget) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      if (!touch) {
        resetGesture();
        return;
      }

      startX = touch.clientX;
      startY = touch.clientY;
      activeGesture = true;
      gestureAxis = "undecided";
      const metrics = getSegmentMetrics();
      gestureSegmentWidth = metrics.segmentWidth;
      gestureMinOffset = metrics.minOffset;
      gestureMaxOffset = metrics.maxOffset;
      setIndicatorOffset(0, { immediate: true });
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!activeGesture || ignoredTarget || event.touches.length === 0) {
        return;
      }

      const touch = event.touches[0];
      if (!touch || startX === null || startY === null) {
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (gestureAxis === "undecided") {
        if (absX < 6 && absY < 6) {
          return;
        }
        if (absY > absX * 1.1) {
          gestureAxis = "vertical";
          activeGesture = false;
          currentOffsetPx = 0;
          resetIndicatorOffset(false);
          return;
        }
        if (absX > absY * 1.1) {
          gestureAxis = "horizontal";
        } else {
          return;
        }
      }

      if (gestureAxis !== "horizontal" || absY > Math.max(16, absX * 1.2)) {
        activeGesture = false;
        currentOffsetPx = 0;
        resetIndicatorOffset(false);
        return;
      }

      const offset = clamp(-deltaX * SWIPE_DRAG_RESISTANCE, gestureMinOffset, gestureMaxOffset);
      currentOffsetPx = offset;
      setIndicatorOffset(offset, { immediate: true });
      event.preventDefault();
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!activeGesture || ignoredTarget || event.changedTouches.length === 0) {
        resetIndicatorOffset(false);
        resetGesture();
        return;
      }

      const touch = event.changedTouches[0];
      if (!touch || startX === null || startY === null) {
        resetGesture();
        return;
      }

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const segmentWidth = gestureSegmentWidth > 0 ? gestureSegmentWidth : 1;
      const targetIndex = clamp(
        Math.round(activeIndex + currentOffsetPx / segmentWidth),
        0,
        KAI_ROUTE_TABS.length - 1
      );
      resetGesture();

      if (absY > SWIPE_VERTICAL_LIMIT_PX || absX < absY * SWIPE_DIRECTION_RATIO) {
        resetIndicatorOffset(false);
        return;
      }

      if (targetIndex === activeIndex) {
        resetIndicatorOffset(false);
        return;
      }

      const targetHref = KAI_ROUTE_TABS[targetIndex]?.href;
      if (!targetHref) {
        resetIndicatorOffset(false);
        return;
      }

      const commitOffset = (targetIndex - activeIndex) * segmentWidth;
      setIndicatorOffset(commitOffset, { immediate: false, durationMs: 150 });
      routePushTimeout = window.setTimeout(() => {
        scrollAppToTop("auto");
        router.push(targetHref);
      }, 110);
    };

    const onTouchCancel = () => {
      resetIndicatorOffset(false);
      resetGesture();
    };

    tabRoot.addEventListener("touchstart", onTouchStart, { passive: true });
    tabRoot.addEventListener("touchmove", onTouchMove, { passive: false });
    tabRoot.addEventListener("touchend", onTouchEnd, { passive: true });
    tabRoot.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      if (routePushTimeout) {
        window.clearTimeout(routePushTimeout);
      }
      tabRoot.removeEventListener("touchstart", onTouchStart);
      tabRoot.removeEventListener("touchmove", onTouchMove);
      tabRoot.removeEventListener("touchend", onTouchEnd);
      tabRoot.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [mounted, hideTabsForPath, pathname, router]);

  useEffect(() => {
    const root = segmentedPillRef.current;
    const indicator = root?.querySelector<HTMLElement>("[data-segment-indicator]") ?? null;
    if (!root || !indicator) return;
    indicator.style.transition = "";
    root.style.setProperty("--segment-drag-x", "0px");
  }, [pathname]);

  if (!mounted || typeof document === "undefined" || hideTabsForPath) {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[90]"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + var(--app-top-safe-offset, 0px) + 58px)",
      }}
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
        <div className="pointer-events-auto w-full max-w-[460px] touch-none">
          <SegmentedPill
            ref={segmentedPillRef}
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
