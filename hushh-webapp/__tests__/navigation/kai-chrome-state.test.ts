import { describe, expect, it, beforeEach } from "vitest";

import { getKaiChromeState } from "@/lib/navigation/kai-chrome-state";

describe("getKaiChromeState", () => {
  beforeEach(() => {
    document.cookie = "kai_onboarding_flow_active=0; path=/";
  });

  it("uses onboarding chrome on onboarding/import routes", () => {
    expect(getKaiChromeState("/kai/onboarding").useOnboardingChrome).toBe(true);
    expect(getKaiChromeState("/kai/import").useOnboardingChrome).toBe(true);
  });

  it("hides command bar when onboarding flow cookie is active", () => {
    document.cookie = "kai_onboarding_flow_active=1; path=/";
    const state = getKaiChromeState("/kai/dashboard");
    expect(state.onboardingFlowActive).toBe(true);
    expect(state.hideCommandBar).toBe(true);
    expect(state.useOnboardingChrome).toBe(true);
  });
});
