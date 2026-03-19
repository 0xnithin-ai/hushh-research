import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

function projectRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot(), relativePath), "utf8");
}

describe("interaction and cache contract", () => {
  it("keeps shared interaction shells aligned with full-surface ripple behavior", () => {
    const navbar = read("components/navbar.tsx");
    const topAppBar = read("components/app-ui/top-app-bar.tsx");
    const materialRipple = read("lib/morphy-ux/material-ripple.tsx");

    expect(navbar).toContain('hitArea="segment"');
    expect(navbar).not.toContain('hitArea="content"');

    expect(topAppBar).toContain('<Check className="ml-auto h-4 w-4 text-current" />');
    expect(topAppBar).toContain('<Loader2 className="ml-auto h-4 w-4 animate-spin text-current" />');

    expect(materialRipple).toContain("morphy-ripple-host");
    expect(materialRipple).toContain('contain: "paint"');
  });

  it("keeps kai market home on stale-aware cache refreshes", () => {
    const kaiMarketHome = read("components/kai/views/kai-market-preview-view.tsx");

    expect(kaiMarketHome).toContain("staleOnly?: boolean");
    expect(kaiMarketHome).toContain("parseStoredKaiHomeCache");
    expect(kaiMarketHome).toContain("cache.peek<KaiHomeInsightsV2>");
    expect(kaiMarketHome).toContain("refresh({ staleOnly: true })");
  });
});
