"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AuthStep } from "@/components/onboarding/AuthStep";
import { HushhLoader } from "@/components/app-ui/hushh-loader";
import { ROUTES } from "@/lib/navigation/routes";

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || ROUTES.KAI_HOME;

  return (
    <AuthStep
      redirectPath={redirectPath}
      compact
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<HushhLoader label="Loading login..." variant="fullscreen" />}>
      <LoginContent />
    </Suspense>
  );
}
