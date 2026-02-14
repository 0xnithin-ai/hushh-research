// components/kai/kai-search-bar.tsx

/**
 * Kai Search Bar - Command palette for triggering stock analysis
 *
 * Delegates search UI to StockSearch (Popover on desktop, Drawer on mobile).
 *
 * IMPORTANT UX:
 * - Must align to the bottom pill navbar container width (centered, px-4)
 * - Must be clickable (no overlay/pointer-events issues)
 * - Selecting a ticker navigates immediately; vault gating happens later in the flow
 */

"use client";

import { StockSearch } from "@/components/kai/views/stock-search";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface KaiSearchBarProps {
  onCommand: (command: string, params?: Record<string, unknown>) => void;
  /** @deprecated – no longer used; StockSearch has its own suggestion list */
  holdings?: string[];
  /** @deprecated – no longer used */
  placeholder?: string;
  disabled?: boolean;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function KaiSearchBar({
  onCommand,
  disabled = false,
}: KaiSearchBarProps) {
  const handleSelect = (ticker: string) => {
    onCommand("analyze", { symbol: ticker });
  };

  return (
    <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] inset-x-0 z-[130] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-[315px]">
        <StockSearch
          onSelect={handleSelect}
          className={cn(
            "w-full",
            disabled ? "pointer-events-none opacity-50" : ""
          )}
        />
      </div>
    </div>
  );
}
