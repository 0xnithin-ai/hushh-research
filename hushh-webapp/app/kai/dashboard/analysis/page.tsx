"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { HushhLoader } from "@/components/app-ui/hushh-loader";

export default function LegacyKaiDashboardAnalysisRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    router.replace(query ? `/kai/analysis?${query}` : "/kai/analysis");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-72 items-center justify-center">
      <HushhLoader variant="inline" label="Redirecting to analysis…" />
    </div>
  );
}
