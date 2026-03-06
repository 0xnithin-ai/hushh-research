"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/navigation/routes";
import { RiaService } from "@/lib/services/ria-service";

export function PersonaBootstrapRedirect() {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const ranRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!isAuthenticated || !user || ranRef.current) {
        return;
      }
      if (pathname !== ROUTES.KAI_HOME && pathname !== ROUTES.RIA_HOME) {
        return;
      }

      ranRef.current = true;
      try {
        const idToken = await user.getIdToken();
        const persona = await RiaService.getPersonaState(idToken);
        if (cancelled) return;

        if (pathname === ROUTES.KAI_HOME && persona.last_active_persona === "ria") {
          router.replace(ROUTES.RIA_CLIENTS);
          return;
        }

        if (pathname === ROUTES.RIA_HOME && persona.last_active_persona === "investor") {
          router.replace(ROUTES.KAI_HOME);
        }
      } catch {
        // ignore bootstrap redirect failure
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, pathname, router, user]);

  return null;
}
