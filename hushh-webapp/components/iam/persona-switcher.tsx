"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { ROUTES } from "@/lib/navigation/routes";
import { RiaService, type Persona, type PersonaState } from "@/lib/services/ria-service";
import { cn } from "@/lib/utils";

function routeForPersona(persona: Persona): string {
  return persona === "ria" ? ROUTES.RIA_CLIENTS : ROUTES.KAI_HOME;
}

export function PersonaSwitcher({ className }: { className?: string }) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<PersonaState | null>(null);
  const [switching, setSwitching] = useState<Persona | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isAuthenticated || !user) {
        setState(null);
        return;
      }
      try {
        const idToken = await user.getIdToken();
        const next = await RiaService.getPersonaState(idToken);
        if (!cancelled) {
          setState(next);
        }
      } catch {
        if (!cancelled) {
          setState(null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !state) {
    return null;
  }

  async function onSwitch(target: Persona) {
    const currentState = state;
    if (!user || !currentState || target === currentState.last_active_persona) {
      if (currentState && target !== currentState.last_active_persona) {
        router.push(routeForPersona(target));
      }
      return;
    }

    setSwitching(target);
    try {
      const idToken = await user.getIdToken();
      const next = await RiaService.switchPersona(idToken, target);
      setState(next);
      const nextRoute = routeForPersona(target);
      if (!pathname.startsWith(nextRoute)) {
        router.push(nextRoute);
      }
    } catch (error) {
      console.warn("[PersonaSwitcher] switch failed", error);
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/80 p-1", className)}>
      <button
        type="button"
        onClick={() => void onSwitch("investor")}
        disabled={switching !== null}
        className={cn(
          "rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
          state.last_active_persona === "investor"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Investor
      </button>
      <button
        type="button"
        onClick={() => void onSwitch("ria")}
        disabled={switching !== null}
        className={cn(
          "rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
          state.last_active_persona === "ria"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        RIA
      </button>
      <button
        type="button"
        onClick={() => router.push(ROUTES.MARKETPLACE)}
        className="rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Market
      </button>
    </div>
  );
}
