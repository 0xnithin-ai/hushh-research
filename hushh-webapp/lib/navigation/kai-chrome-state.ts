import { ROUTES, isKaiOnboardingRoute } from "@/lib/navigation/routes";
import { isOnboardingFlowActiveCookieEnabled } from "@/lib/services/onboarding-route-cookie";

export interface KaiChromeState {
  isOnboardingRoute: boolean;
  isImportRoute: boolean;
  onboardingFlowActive: boolean;
  useOnboardingChrome: boolean;
  hideCommandBar: boolean;
}

function isKaiImportRoute(pathname: string): boolean {
  return pathname === ROUTES.KAI_IMPORT || pathname.startsWith(`${ROUTES.KAI_IMPORT}/`);
}

export function getKaiChromeState(
  pathname: string | null | undefined,
  options?: {
    onboardingFlowActive?: boolean;
  }
): KaiChromeState {
  const path = pathname ?? "";
  const isOnboardingRoute = isKaiOnboardingRoute(path);
  const isImportRoute = isKaiImportRoute(path);
  const onboardingFlowActive =
    options?.onboardingFlowActive ?? isOnboardingFlowActiveCookieEnabled();
  const useOnboardingChrome = isOnboardingRoute || isImportRoute || onboardingFlowActive;
  const hideCommandBar =
    useOnboardingChrome ||
    path === ROUTES.HOME ||
    path.startsWith(ROUTES.LOGIN) ||
    path.startsWith(ROUTES.LOGOUT);

  return {
    isOnboardingRoute,
    isImportRoute,
    onboardingFlowActive,
    useOnboardingChrome,
    hideCommandBar,
  };
}
