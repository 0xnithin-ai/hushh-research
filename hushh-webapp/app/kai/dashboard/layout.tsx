"use client";

/**
 * Kai Dashboard Layout
 *
 * VaultLockGuard and ConsentSSEProvider are provided by parent app/kai/layout.tsx.
 * Pass-through to preserve flex scroll behavior.
 */

import { DashboardRouteTabs } from "@/components/kai/layout/dashboard-route-tabs";

export default function KaiDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <DashboardRouteTabs />
      <div className="w-full pb-24">{children}</div>
    </div>
  );
}
