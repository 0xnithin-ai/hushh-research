"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { KaiCommandPalette, type KaiCommandAction } from "@/components/kai/kai-command-palette";
import { Button } from "@/lib/morphy-ux/button";
import { Icon } from "@/lib/morphy-ux/ui";
import { cn } from "@/lib/utils";
import { useKaiBottomChromeVisibility } from "@/lib/navigation/kai-bottom-chrome-visibility";

interface KaiSearchBarProps {
  onCommand: (command: KaiCommandAction, params?: Record<string, unknown>) => void;
  disabled?: boolean;
  hasPortfolioData?: boolean;
}

export function KaiSearchBar({
  onCommand,
  disabled = false,
  hasPortfolioData = true,
}: KaiSearchBarProps) {
  const [open, setOpen] = useState(false);
  const { hidden: hideBottomChrome } = useKaiBottomChromeVisibility(true);

  return (
    <>
      <div
        className={cn(
          "fixed inset-x-0 z-[130] flex justify-center px-4 transition-all duration-300 ease-out",
          hideBottomChrome
            ? "pointer-events-none opacity-0"
            : "pointer-events-none opacity-100"
        )}
        style={{
          bottom: "calc(var(--app-bottom-inset) + var(--kai-command-bottom-gap, 18px))",
          transform: hideBottomChrome
            ? "translate3d(0, calc(100% + 24px), 0)"
            : "translate3d(0, 0, 0)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-1/2 h-[72px] w-screen -translate-x-1/2 bottom-bar-glass"
        />
        <div className="pointer-events-auto w-full max-w-[420px]">
          <Button
            variant="none"
            effect="fade"
            fullWidth
            size="default"
            className={cn(
              "h-12 justify-start rounded-full px-4 text-sm text-muted-foreground",
              disabled && "pointer-events-none opacity-50"
            )}
            onClick={() => setOpen(true)}
          >
            <Icon icon={Search} size="sm" className="mr-2 text-muted-foreground" />
            Analyze, optimize, manage with Kai
          </Button>
        </div>
      </div>

      <KaiCommandPalette
        open={open}
        onOpenChange={setOpen}
        onCommand={onCommand}
        hasPortfolioData={hasPortfolioData}
      />
    </>
  );
}
