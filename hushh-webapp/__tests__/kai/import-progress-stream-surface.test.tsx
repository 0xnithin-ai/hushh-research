import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/morphy-ux/hooks/use-smooth-stream-progress", () => ({
  useSmoothStreamProgress: (value: number) => value,
}));

import { ImportProgressView } from "@/components/kai/views/import-progress-view";

describe("ImportProgressView stream surface", () => {
  it("renders stage timeline + extracted holdings only", () => {
    render(
      <ImportProgressView
        stage="parsing"
        stageTrail={["[INDEXING] Indexing document structure..."]}
        isStreaming
        liveHoldings={[
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            quantity: 12,
            market_value: 2450,
          },
        ]}
        holdingsExtracted={1}
        holdingsTotal={3}
      />
    );

    expect(screen.getByText("AI Stream Transcript")).toBeTruthy();
    expect(screen.getByText("Stage timeline")).toBeTruthy();
    expect(screen.getByText(/\[INDEXING\] Indexing document structure\.\.\./)).toBeTruthy();
    expect(screen.getByText("Extracted Holdings")).toBeTruthy();
    expect(screen.queryByText(/reasoning/i)).toBeNull();
    expect(screen.queryByText(/characters processed/i)).toBeNull();
  });
});
