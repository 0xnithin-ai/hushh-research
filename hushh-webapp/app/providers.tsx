"use client";

/**
 * Unified Client Providers
 *
 * Wraps all client-side providers in a single "use client" boundary
 * to ensure proper hydration and avoid server/client mismatch issues.
 *
 * Uses StepProgressProvider for step-based loading progress tracking.
 * Pages register their loading steps and the progress bar shows real progress.
 *
 * CacheProvider enables data sharing across page navigations to reduce API calls.
 */

import { CSSProperties, ReactNode, useEffect, useMemo, useRef } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/firebase";
import { VaultProvider } from "@/lib/vault/vault-context";
import { NavigationProvider } from "@/lib/navigation/navigation-context";
import { StepProgressProvider } from "@/lib/progress/step-progress-context";
import { StepProgressBar } from "@/components/app-ui/step-progress-bar";
import { CacheProvider } from "@/lib/cache/cache-context";
import { ConsentNotificationProvider } from "@/components/consent/notification-provider";
import { resolveTopShellRouteProfile } from "@/components/app-ui/top-shell-metrics";
import { TopAppBar } from "@/components/app-ui/top-app-bar";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { StatusBarManager } from "@/components/status-bar-manager";
import { usePathname } from "next/navigation";
import { ensureMorphyGsapReady } from "@/lib/morphy-ux/gsap-init";
import { usePageEnterAnimation } from "@/lib/morphy-ux/hooks/use-page-enter";
import { PostAuthOnboardingSyncBridge } from "@/components/onboarding/PostAuthOnboardingSyncBridge";
import { KaiCommandBarGlobal } from "@/components/kai/kai-command-bar-global";
import { useScrollReset } from "@/lib/navigation/use-scroll-reset";
import { Capacitor } from "@capacitor/core";
import { ObservabilityRouteObserver } from "@/components/observability/route-observer";
import {
  resetKaiBottomChromeVisibility,
  useKaiBottomChromeVisibility,
} from "@/lib/navigation/kai-bottom-chrome-visibility";
import { getKaiChromeState } from "@/lib/navigation/kai-chrome-state";
import { cn } from "@/lib/utils";
import { PersonaBootstrapRedirect } from "@/components/iam/persona-bootstrap-redirect";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const isImportRoute = pathname.startsWith("/kai/import");
  const chromeState = useMemo(() => getKaiChromeState(pathname), [pathname]);
  const topShellRouteProfile = useMemo(
    () => resolveTopShellRouteProfile(pathname),
    [pathname]
  );
  const topShellMetrics = topShellRouteProfile.metrics;
  const hideGlobalChrome = !topShellMetrics.shellVisible;
  const isFullscreenTopFlow = topShellMetrics.contentOffsetMode === "fullscreen-flow";
  const shouldLockFullscreenRoot = isFullscreenTopFlow && !isImportRoute;
  const shouldRenderTopSpacer =
    topShellMetrics.shellVisible && (!isFullscreenTopFlow || isImportRoute);
  const topShellRouteStyle = useMemo(
    () =>
      ({
        "--top-tabs-gap": "0px",
        "--top-tabs-total": topShellMetrics.hasTabs
          ? "calc(var(--top-tabs-h) + var(--top-tabs-gap))"
          : "0px",
        "--top-systembar-row-gap": topShellMetrics.hasTabs ? "4px" : "6px",
        "--top-fade-active": topShellMetrics.hasTabs ? "24px" : "8px",
        "--top-content-pad": topShellMetrics.hasTabs
          ? "var(--top-glass-h)"
          : "calc(var(--top-shell-h) + 2px)",
        "--kai-route-content-gap": topShellMetrics.hasTabs ? "20px" : "10px",
        "--kai-route-content-gap-sm": topShellMetrics.hasTabs ? "24px" : "14px",
        "--app-top-shell-visible": topShellMetrics.shellVisible ? "1" : "0",
        "--app-top-has-tabs": topShellMetrics.hasTabs ? "1" : "0",
        "--app-top-offset-mode":
          topShellMetrics.contentOffsetMode === "fullscreen-flow" ? "fullscreen-flow" : "normal",
        "--app-scroll-bottom-pad": chromeState.hideCommandBar
          ? "var(--app-bottom-inset)"
          : "calc(var(--app-bottom-inset) + var(--kai-command-fixed-ui))",
      } as CSSProperties),
    [
      chromeState.hideCommandBar,
      topShellMetrics.contentOffsetMode,
      topShellMetrics.hasTabs,
      topShellMetrics.shellVisible,
    ]
  );
  const showSharedBottomChromeGlass = topShellMetrics.shellVisible && !isFullscreenTopFlow;
  const { hidden: hideBottomChromeGlass, progress: hideBottomChromeGlassProgress } = useKaiBottomChromeVisibility(
    showSharedBottomChromeGlass
  );
  const pageRef = useRef<HTMLDivElement | null>(null);
  const pageAnimationKey = useMemo(
    () => (pathname.startsWith("/kai") ? "/kai-stable-shell" : pathname),
    [pathname]
  );

  // One-time GSAP init (non-blocking).
  useEffect(() => {
    void ensureMorphyGsapReady();
  }, []);

  // Add a root platform class for native-iOS specific CSS hooks.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const isNativeIOS =
      Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
    root.classList.toggle("native-ios", isNativeIOS);
    return () => root.classList.remove("native-ios");
  }, []);

  // App-wide page enter fade.
  usePageEnterAnimation(pageRef, { enabled: true, key: pageAnimationKey });
  useScrollReset(pathname, { enabled: true, behavior: "auto" });

  useEffect(() => {
    resetKaiBottomChromeVisibility();
  }, [pathname]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ObservabilityRouteObserver />
      <StepProgressProvider>
        <StatusBarManager />
        {/* Step-based progress bar at top of viewport */}
        <StepProgressBar />
        <AuthProvider>
          <PersonaBootstrapRedirect />
          <CacheProvider>
            <VaultProvider>
              <ConsentNotificationProvider>
                <NavigationProvider>
                  {/* Flex container for proper scroll behavior */}
                  <div
                    className="flex flex-col flex-1 min-h-0"
                    style={topShellRouteStyle}
                    data-top-shell-profile={topShellRouteProfile.id}
                  >
                    <Navbar />
                    <TopAppBar />
                    {showSharedBottomChromeGlass ? (
                      <div
                        aria-hidden
                        className={cn(
                          "pointer-events-none fixed inset-x-0 bottom-0 z-[108] transform-gpu",
                          hideBottomChromeGlass ? "opacity-0" : "opacity-100"
                        )}
                        style={{
                          transform: `translate3d(0, calc(${100 * hideBottomChromeGlassProgress}% + ${10 * hideBottomChromeGlassProgress}px), 0)`,
                          opacity: Math.max(0, 1 - hideBottomChromeGlassProgress),
                        } as CSSProperties}
                      >
                        <div
                          className="h-[calc(var(--app-bottom-inset)+var(--kai-command-fixed-ui)+36px)] w-full bar-glass"
                          style={
                            {
                              "--app-bar-glass-bg-light": "rgba(255, 255, 255, 0.5)",
                              "--app-bar-glass-bg-dark": "rgba(10, 12, 16, 0.74)",
                              "--app-bar-glass-blur": "8px",
                              "--app-bar-border-top": "1px solid rgba(255, 255, 255, 0.26)",
                              "--app-bar-shadow":
                                "inset 0 1px 0 rgba(255,255,255,0.18), 0 -14px 30px rgba(0,0,0,0.18)",
                              maskImage:
                                "linear-gradient(to top, black 0%, black 62%, rgba(0, 0, 0, 0.95) 76%, rgba(0, 0, 0, 0.72) 88%, rgba(0, 0, 0, 0.36) 95%, transparent 100%)",
                              WebkitMaskImage:
                                "linear-gradient(to top, black 0%, black 62%, rgba(0, 0, 0, 0.95) 76%, rgba(0, 0, 0, 0.72) 88%, rgba(0, 0, 0, 0.36) 95%, transparent 100%)",
                            } as CSSProperties
                          }
                        />
                      </div>
                    ) : null}
                    <PostAuthOnboardingSyncBridge />
                    <KaiCommandBarGlobal />
                    {/* Main scroll container: extends under fixed bar so content can scroll behind it; padding clears bar height */}
                    <div
                      data-app-scroll-root="true"
                      data-app-scroll-mode={
                        hideGlobalChrome
                          ? "hidden-shell"
                          : shouldLockFullscreenRoot
                          ? "fullscreen-flow"
                          : "standard"
                      }
                      className={
                        hideGlobalChrome
                          ? // Landing/onboarding flows should still allow vertical scroll on small screens.
                            "flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none overscroll-y-contain touch-pan-y relative z-10 min-h-0"
                          : shouldLockFullscreenRoot
                          ? // Fullscreen flows keep chrome contract, but permit y-scroll for small devices.
                            "flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none touch-pan-y relative z-10 min-h-0"
                          : "flex-1 overflow-y-auto overflow-x-hidden overscroll-x-none touch-pan-y pb-[var(--app-scroll-bottom-pad,var(--app-bottom-inset))] relative z-10 min-h-0"
                      }
                    >
                      {shouldRenderTopSpacer ? (
                        <div
                          aria-hidden
                          className="w-full shrink-0"
                          style={{ height: "var(--top-content-pad)" }}
                        />
                      ) : null}
                      <div
                        ref={pageRef}
                        className={shouldLockFullscreenRoot ? "min-h-0 h-full" : "min-h-0"}
                      >
                        {children}
                      </div>
                    </div>
                  </div>
                  <Toaster
                    position="top-center"
                    closeButton
                    offset={{
                      top: "calc(var(--top-inset, 0px) + 12px)",
                    }}
                    mobileOffset={{
                      top: "calc(var(--top-inset, 0px) + 12px)",
                    }}
                  />
                </NavigationProvider>
              </ConsentNotificationProvider>
            </VaultProvider>
          </CacheProvider>
        </AuthProvider>
      </StepProgressProvider>
    </ThemeProvider>
  );
}
