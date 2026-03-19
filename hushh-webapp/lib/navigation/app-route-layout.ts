import { ROUTES } from "@/lib/navigation/routes";

export type AppRouteLayoutMode = "standard" | "flow" | "redirect" | "hidden";

export interface AppRouteShellVerification {
  file: string;
  includes: readonly string[];
}

export interface AppRouteLayoutContractEntry {
  route: string;
  mode: AppRouteLayoutMode;
  shellVerification?: AppRouteShellVerification;
}

export const APP_ROUTE_LAYOUT_CONTRACT: readonly AppRouteLayoutContractEntry[] = [
  { route: ROUTES.HOME, mode: "hidden" },
  {
    route: ROUTES.DEVELOPERS,
    mode: "standard",
    shellVerification: {
      file: "components/developers/developer-docs-hub.tsx",
      includes: ["AppPageShell", "AppPageHeaderRegion", "AppPageContentRegion"],
    },
  },
  { route: ROUTES.LOGIN, mode: "hidden" },
  { route: ROUTES.LOGOUT, mode: "hidden" },
  { route: ROUTES.LABS_PROFILE_APPEARANCE, mode: "hidden" },
  {
    route: ROUTES.CONSENTS,
    mode: "standard",
    shellVerification: {
      file: "components/consent/consent-center-view.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.KAI_HOME,
    mode: "standard",
    shellVerification: {
      file: "components/kai/views/kai-market-preview-view.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.KAI_ANALYSIS,
    mode: "standard",
    shellVerification: {
      file: "app/kai/analysis/page.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  { route: "/kai/dashboard", mode: "redirect" },
  {
    route: "/kai/dashboard/analysis",
    mode: "redirect",
    shellVerification: {
      file: "app/kai/dashboard/analysis/page.tsx",
      includes: ["AppPageShell"],
    },
  },
  {
    route: ROUTES.KAI_IMPORT,
    mode: "standard",
    shellVerification: {
      file: "app/kai/import/page.tsx",
      includes: ["AppPageShell", "AppPageContentRegion"],
    },
  },
  {
    route: ROUTES.KAI_INVESTMENTS,
    mode: "standard",
    shellVerification: {
      file: "components/kai/views/investments-master-view.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.KAI_ONBOARDING,
    mode: "flow",
  },
  {
    route: ROUTES.KAI_OPTIMIZE,
    mode: "standard",
    shellVerification: {
      file: "app/kai/optimize/page.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.KAI_PLAID_OAUTH_RETURN,
    mode: "standard",
    shellVerification: {
      file: "app/kai/plaid/oauth/return/page.tsx",
      includes: ["AppPageShell"],
    },
  },
  {
    route: ROUTES.KAI_PORTFOLIO,
    mode: "standard",
    shellVerification: {
      file: "app/kai/portfolio/page.tsx",
      includes: ["AppPageShell", "AppPageContentRegion"],
    },
  },
  {
    route: ROUTES.MARKETPLACE,
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell"],
    },
  },
  {
    route: `${ROUTES.MARKETPLACE_RIA_PROFILE}/[riaId]`,
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell"],
    },
  },
  {
    route: ROUTES.PROFILE,
    mode: "standard",
    shellVerification: {
      file: "app/profile/page.tsx",
      includes: ["AppPageShell"],
    },
  },
  {
    route: ROUTES.RIA_HOME,
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.RIA_CLIENTS,
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.RIA_ONBOARDING,
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.RIA_PICKS,
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
  {
    route: ROUTES.RIA_REQUESTS,
    mode: "redirect",
  },
  {
    route: ROUTES.RIA_SETTINGS,
    mode: "redirect",
  },
  {
    route: "/ria/workspace/[clientId]",
    mode: "standard",
    shellVerification: {
      file: "components/ria/ria-page-shell.tsx",
      includes: ["AppPageShell", "SurfaceStack"],
    },
  },
] as const;

const DEFAULT_ROUTE_LAYOUT: AppRouteLayoutContractEntry = {
  route: "*",
  mode: "standard",
};

function normalizePathname(pathname: string): string {
  const trimmed = pathname.split(/[?#]/, 1)[0]?.trim() || "/";
  if (trimmed === "/") return "/";
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function isDynamicSegment(segment: string): boolean {
  return segment.startsWith("[") && segment.endsWith("]");
}

function matchRoutePattern(pathname: string, routePattern: string): boolean {
  const normalizedPath = normalizePathname(pathname);
  if (routePattern === "/") return normalizedPath === "/";

  const pathSegments = normalizedPath.split("/").filter(Boolean);
  const patternSegments = routePattern.split("/").filter(Boolean);

  if (pathSegments.length !== patternSegments.length) return false;

  return patternSegments.every((patternSegment, index) => {
    if (isDynamicSegment(patternSegment)) {
      return Boolean(pathSegments[index]);
    }
    return patternSegment === pathSegments[index];
  });
}

export function resolveAppRouteLayout(pathname: string): AppRouteLayoutContractEntry {
  return (
    APP_ROUTE_LAYOUT_CONTRACT.find((entry) => matchRoutePattern(pathname, entry.route)) ??
    DEFAULT_ROUTE_LAYOUT
  );
}

export function resolveAppRouteLayoutMode(pathname: string): AppRouteLayoutMode {
  return resolveAppRouteLayout(pathname).mode;
}
