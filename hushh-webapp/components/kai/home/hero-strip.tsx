"use client";

import { Button } from "@/lib/morphy-ux/button";

interface HeroStripProps {
  onOpenDashboard: () => void;
}

export function HeroStrip({ onOpenDashboard }: HeroStripProps) {
  return (
    <div className="flex justify-end">
      <Button
        variant="none"
        effect="fill"
        size="sm"
        onClick={onOpenDashboard}
        className="bg-black px-5 text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
      >
        Open Dashboard
      </Button>
    </div>
  );
}
