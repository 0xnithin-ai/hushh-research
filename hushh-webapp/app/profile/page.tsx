"use client";

/**
 * Profile Page
 *
 * Shows user info from authentication providers (Google, Apple, etc.), 
 * world model domains with KPI cards, sign out button, and theme toggle.
 * Mobile-first design with Morphy-UX styling.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/lib/morphy-ux/morphy";
import { useAuth } from "@/hooks/use-auth";
import { useVault } from "@/lib/vault/vault-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { KaiPreferencesSheet } from "@/components/kai/onboarding/KaiPreferencesSheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useStepProgress } from "@/lib/progress/step-progress-context";
import {
  User, 
  LogOut, 
  Fingerprint,
  KeyRound,
  Cloud,
  HardDrive,
  RefreshCw,
  Wallet, 
  CreditCard, 
  Heart, 
  Plane, 
  Tv, 
  ShoppingBag, 
  Folder,
  Loader2,
  MessageSquare,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Bug,
  Code2,
  LifeBuoy,
  SendHorizontal,
} from "lucide-react";
import { WorldModelService, DomainSummary } from "@/lib/services/world-model-service";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VaultFlow } from "@/components/vault/vault-flow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountService } from "@/lib/services/account-service";
import { VaultService } from "@/lib/services/vault-service";
import {
  VaultMethodService,
  type VaultCapabilityMatrix,
  type VaultMethod,
} from "@/lib/services/vault-method-service";
import { resolveDeleteAccountAuth } from "@/lib/flows/delete-account";
import { toast } from "sonner";
import { CacheSyncService } from "@/lib/cache/cache-sync-service";
import { UserLocalStateService } from "@/lib/services/user-local-state-service";
import {
  setOnboardingFlowActiveCookie,
  setOnboardingRequiredCookie,
} from "@/lib/services/onboarding-route-cookie";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/lib/morphy-ux/ui";
import { ROUTES } from "@/lib/navigation/routes";
import { toInvestorMessage } from "@/lib/copy/investor-language";
import { RiaService } from "@/lib/services/ria-service";
import { usePersonaState } from "@/lib/persona/persona-context";
import { ContentSurface, SectionHeader } from "@/components/app-ui/page-sections";
import { cn } from "@/lib/utils";
import { usePendingConsentCount } from "@/components/consent/notification-provider";
import { Textarea } from "@/components/ui/textarea";
import {
  SupportService,
  type SupportMessageKind,
} from "@/lib/services/support-service";

// Icon mapping for domains
const DOMAIN_ICONS: Record<string, LucideIcon> = {
  financial: Wallet,
  subscriptions: CreditCard,
  health: Heart,
  travel: Plane,
  entertainment: Tv,
  shopping: ShoppingBag,
  general: Folder,
  wallet: Wallet,
  "credit-card": CreditCard,
  heart: Heart,
  plane: Plane,
  tv: Tv,
  "shopping-bag": ShoppingBag,
  folder: Folder,
};

function ProfileSection({
  id,
  eyebrow,
  title,
  description,
  actions,
  icon,
  children,
  className,
  surfaceClassName,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  surfaceClassName?: string;
}) {
  return (
    <section id={id} className={cn("space-y-3", className)}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={actions}
        icon={icon}
      />
      <ContentSurface className={surfaceClassName}>{children}</ContentSurface>
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const { personaState, refresh: refreshPersonaState } = usePersonaState();
  const { vaultKey, vaultOwnerToken, isVaultUnlocked } = useVault();
  const pendingConsents = usePendingConsentCount();
  const { registerSteps, completeStep, reset } = useStepProgress();
  const [showVaultUnlock, setShowVaultUnlock] = useState(false);
  const [vaultUnlockReason, setVaultUnlockReason] = useState<
    "profile_data" | "delete_account"
  >("profile_data");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasVault, setHasVault] = useState<boolean | null>(null);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [totalAttributes, setTotalAttributes] = useState(0);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [vaultMethod, setVaultMethod] = useState<VaultMethod | null>(null);
  const [capabilityMatrix, setCapabilityMatrix] =
    useState<VaultCapabilityMatrix | null>(null);
  const [loadingVaultMethod, setLoadingVaultMethod] = useState(false);
  const [switchingVaultMethod, setSwitchingVaultMethod] = useState(false);
  const [passphraseDialogOpen, setPassphraseDialogOpen] = useState(false);
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showKaiPreferencesSheet, setShowKaiPreferencesSheet] = useState(false);
  const [marketplaceOptIn, setMarketplaceOptIn] = useState(false);
  const [loadingMarketplaceOptIn, setLoadingMarketplaceOptIn] = useState(true);
  const [savingMarketplaceOptIn, setSavingMarketplaceOptIn] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportKind, setSupportKind] =
    useState<SupportMessageKind>("support_request");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [sendingSupportMessage, setSendingSupportMessage] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadVaultState() {
      if (authLoading) return;
      if (!user?.uid) return;
      try {
        const next = await VaultService.checkVault(user.uid);
        if (!cancelled) setHasVault(next);
      } catch (error) {
        console.warn("[ProfilePage] Failed to check vault existence:", error);
        if (!cancelled) setHasVault(false);
      }
    }

    void loadVaultState();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.uid]);

  async function refreshVaultMethodState(targetUserId: string) {
    try {
      setLoadingVaultMethod(true);
      const [capability, currentMethod] = await Promise.all([
        VaultMethodService.getCapabilityMatrix(),
        VaultMethodService.getCurrentMethod(targetUserId),
      ]);
      setCapabilityMatrix(capability);
      setVaultMethod(currentMethod);
    } catch (error) {
      console.warn("[ProfilePage] Failed to resolve vault method:", error);
      setVaultMethod(null);
    } finally {
      setLoadingVaultMethod(false);
    }
  }

  useEffect(() => {
    if (authLoading || !user?.uid) return;
    if (hasVault !== true) {
      setVaultMethod(null);
      return;
    }

    void refreshVaultMethodState(user.uid);
  }, [authLoading, hasVault, user?.uid]);

  useEffect(() => {
    if (!user) {
      setMarketplaceOptIn(false);
      setLoadingMarketplaceOptIn(false);
      return;
    }
    if (!personaState) {
      setLoadingMarketplaceOptIn(true);
      return;
    }
    setMarketplaceOptIn(Boolean(personaState.investor_marketplace_opt_in));
    setLoadingMarketplaceOptIn(false);
  }, [personaState, user]);

  // Load world model data - auth is handled by VaultLockGuard in layout
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Wait for auth to finish loading
      if (authLoading) return;

      // Register steps only once
      if (!initialized) {
        registerSteps(1); // Only 1 step now - loading world model data
        setInitialized(true);
      }

      // Load world model data
      if (!user?.uid) return;

      // Wait for vault existence resolution before deciding metadata fetch behavior.
      if (hasVault === null) return;

      try {
        setLoadingDomains(true);

        // No vault yet: show empty profile state without calling protected metadata API.
        if (hasVault === false) {
          if (!cancelled) {
            setDomains([]);
            setTotalAttributes(0);
            completeStep();
          }
          return;
        }

        // Vault exists but token is unavailable (locked/not resolved): avoid 401 and render graceful state.
        if (!vaultOwnerToken) {
          if (!cancelled) {
            setDomains([]);
            setTotalAttributes(0);
            completeStep();
          }
          return;
        }

        const metadata = await WorldModelService.getMetadata(
          user.uid,
          false,
          vaultOwnerToken || undefined
        );
        if (!cancelled) {
          setDomains(metadata.domains);
          setTotalAttributes(metadata.totalAttributes);
          completeStep();
        }
      } catch (error) {
        console.error("Failed to load world model data:", error);
        if (!cancelled) completeStep(); // Complete step on error
      } finally {
        if (!cancelled) setLoadingDomains(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
      reset();
    };
  }, [
    authLoading,
    completeStep,
    hasVault,
    initialized,
    registerSteps,
    reset,
    user?.uid,
    vaultOwnerToken,
  ]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push(ROUTES.HOME);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      const resolution = await resolveDeleteAccountAuth({
        userId: user.uid,
        existingVaultOwnerToken: vaultOwnerToken ?? null,
      });

      if (resolution.kind === "needs_unlock") {
        toast.error("Please unlock your vault first to delete your account.");
        setShowDeleteConfirm(false);
        setVaultUnlockReason("delete_account");
        setShowVaultUnlock(true);
        return;
      }

      // Track vault existence for UI copy paths.
      setHasVault(resolution.hasVault);

      await AccountService.deleteAccount(resolution.token);
      CacheSyncService.onAccountDeleted(user.uid);
      await UserLocalStateService.clearForUser(user.uid);
      setOnboardingRequiredCookie(false);
      setOnboardingFlowActiveCookie(false);
      toast.success("Account deleted successfully. Redirecting...", {
        duration: 3000,
      });
      // Small delay to let user see the toast
      await new Promise(resolve => setTimeout(resolve, 1500));
      await signOut(); // This will auto-redirect to /
    } catch (error) {
      console.error("Delete account error:", error);
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!user) return;

    let nextHasVault = hasVault;
    if (nextHasVault === null) {
      try {
        nextHasVault = await VaultService.checkVault(user.uid);
        setHasVault(nextHasVault);
      } catch (error) {
        console.warn("[ProfilePage] Failed to check vault existence:", error);
        nextHasVault = true;
      }
    }

    // If no vault exists yet, allow direct delete without vault unlock.
    if (!nextHasVault) {
      setShowDeleteConfirm(true);
      return;
    }

    if (isVaultUnlocked) {
      setShowDeleteConfirm(true);
    } else {
      setVaultUnlockReason("delete_account");
      setShowVaultUnlock(true);
    }
  };

  const handleMarketplaceOptInToggle = async () => {
    if (!user) return;
    try {
      setSavingMarketplaceOptIn(true);
      const idToken = await user.getIdToken();
      const result = await RiaService.setInvestorMarketplaceOptIn(idToken, !marketplaceOptIn);
      setMarketplaceOptIn(Boolean(result.investor_marketplace_opt_in));
      CacheSyncService.onMarketplaceVisibilityChanged(user.uid);
      await refreshPersonaState({ force: true });
      toast.success(
        result.investor_marketplace_opt_in
          ? "Investor marketplace profile is now discoverable."
          : "Investor marketplace profile is now hidden."
      );
    } catch (error) {
      console.error("[ProfilePage] Failed to update marketplace opt-in:", error);
      toast.error("Couldn't update marketplace visibility.");
    } finally {
      setSavingMarketplaceOptIn(false);
    }
  };

  // Get provider from Firebase user
  const getProvider = () => {
    if (!user?.providerData || user.providerData.length === 0) {
      return { name: "Unknown", id: "unknown" };
    }
    
    const providerId = user.providerData[0]?.providerId;
    
    switch (providerId) {
      case "google.com":
        return { name: "Google", id: "google" };
      case "apple.com":
        return { name: "Apple", id: "apple" };
      case "password":
        return { name: "Email/Password", id: "password" };
      default:
        return { name: providerId || "Unknown", id: providerId || "unknown" };
    }
  };

  const provider = getProvider();

  const renderProviderIcon = () => {
    if (provider.id === "google") {
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      );
    }

    if (provider.id === "apple") {
      return (
        <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.07-.52-2.07-.51-3.2 0-1.01.43-2.1.49-2.98-.38C5.22 17.63 2.7 12 5.45 8.04c1.47-2.09 3.8-2.31 5.33-1.18 1.1.75 3.3.73 4.45-.04 2.1-1.31 3.55-.95 4.5 1.14-.15.08.2.14 0 .2-2.63 1.34-3.35 6.03.95 7.84-.46 1.4-1.25 2.89-2.26 4.4l-.07.08-.05-.2zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.17 2.22-1.8 4.19-3.74 4.25z" />
        </svg>
      );
    }

    return <Icon icon={User} size="xs" className="shrink-0" />;
  };

  // Show loading state while auth is loading
  if (authLoading) {
    return null;
  }

  const deleteButtonLabel =
    hasVault === true && !isVaultUnlocked
      ? "Unlock to Delete Account"
      : "Delete Account";

  const supportKindCopy: Record<
    SupportMessageKind,
    { title: string; description: string; subject: string }
  > = {
    bug_report: {
      title: "Report a bug",
      description: "Tell us what broke, what you expected, and anything we should look at.",
      subject: "Bug report",
    },
    support_request: {
      title: "Contact support",
      description: "Ask for help with your account, portfolio flows, or something unclear in the app.",
      subject: "Support request",
    },
    developer_reachout: {
      title: "Reach the developer",
      description: "Share product feedback, implementation notes, or a direct engineering question.",
      subject: "Developer feedback",
    },
  };

  const recommendedQuickMethod =
    capabilityMatrix?.recommendedMethod &&
    capabilityMatrix.recommendedMethod !== "passphrase"
      ? capabilityMatrix.recommendedMethod
      : null;

  const readableMethod = (method: VaultMethod | null): string => {
    if (method === "generated_default_native_biometric") return "Device biometric";
    if (method === "generated_default_native_passkey_prf") return "Passkey";
    if (method === "generated_default_web_prf") return "Passkey";
    if (method === "passphrase") return "Passphrase";
    return "Unknown";
  };

  const readableQuickMethod = (method: VaultMethod | null): string => {
    if (method === "generated_default_native_biometric") return "device biometric";
    if (method === "generated_default_native_passkey_prf") return "passkey";
    if (method === "generated_default_web_prf") return "passkey";
    return "quick unlock";
  };

  const canEditKaiPreferences = Boolean(
    user?.uid &&
      hasVault === true &&
      isVaultUnlocked &&
      typeof vaultKey === "string" &&
      vaultKey.length > 0 &&
      typeof vaultOwnerToken === "string" &&
      vaultOwnerToken.length > 0
  );
  const unlockDialogTitle =
    vaultUnlockReason === "delete_account"
      ? "Unlock Vault to Delete Account"
      : "Unlock Vault";
  const unlockDialogDescription =
    vaultUnlockReason === "delete_account"
      ? "Unlock your vault to confirm deletion. This is permanent and removes all encrypted records."
      : "Unlock your vault to access profile settings.";

  function openSupportDialog(kind: SupportMessageKind) {
    setSupportKind(kind);
    setSupportSubject(supportKindCopy[kind].subject);
    setSupportMessage("");
    setSupportDialogOpen(true);
  }

  async function submitSupportMessage() {
    if (!user) return;
    const trimmedSubject = supportSubject.trim();
    const trimmedMessage = supportMessage.trim();

    if (trimmedSubject.length < 3) {
      toast.error("Add a short subject so we can triage this quickly.");
      return;
    }
    if (trimmedMessage.length < 10) {
      toast.error("Add a bit more detail so we can help properly.");
      return;
    }

    setSendingSupportMessage(true);
    try {
      const idToken = await user.getIdToken();
      const pageUrl =
        typeof window !== "undefined" ? window.location.href : ROUTES.PROFILE;
      const result = await SupportService.submitMessage({
        idToken,
        userId: user.uid,
        kind: supportKind,
        subject: trimmedSubject,
        message: trimmedMessage,
        userEmail: user.email,
        userDisplayName: user.displayName,
        persona: personaState?.active_persona || null,
        pageUrl,
      });
      toast.success(
        result.delivery_mode === "test"
          ? `Sent in test mode to ${result.recipient}.`
          : `Sent to ${result.recipient}.`
      );
      setSupportDialogOpen(false);
      setSupportMessage("");
    } catch (error) {
      console.error("[ProfilePage] Failed to send support message:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "We couldn't send your message right now."
      );
    } finally {
      setSendingSupportMessage(false);
    }
  }

  async function switchToQuickMethod(targetMethod: VaultMethod) {
    if (!user?.uid) return;

    if (!isVaultUnlocked || !vaultKey) {
      toast.info("Unlock your vault to change security method.");
      setShowVaultUnlock(true);
      return;
    }

    setSwitchingVaultMethod(true);
    try {
      const result = await VaultMethodService.switchMethod({
        userId: user.uid,
        currentVaultKey: vaultKey,
        displayName: user.displayName || user.email || "Hushh User",
        targetMethod,
      });

      setVaultMethod(result.method);
      toast.success(`Vault method updated to ${readableMethod(result.method)}.`);
      await refreshVaultMethodState(user.uid);
    } catch (error) {
      console.error("[ProfilePage] Failed to switch vault method:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "We could not update your unlock preference."
      );
    } finally {
      setSwitchingVaultMethod(false);
    }
  }

  async function preferPassphraseUnlock() {
    if (!user?.uid) return;

    if (!isVaultUnlocked || !vaultKey) {
      toast.info("Unlock your vault to change security method.");
      setShowVaultUnlock(true);
      return;
    }

    setSwitchingVaultMethod(true);
    try {
      await VaultService.setPrimaryVaultMethod(user.uid, "passphrase", "default");
      setVaultMethod("passphrase");
      toast.success("Primary unlock updated to passphrase.");
      await refreshVaultMethodState(user.uid);
    } catch (error) {
      console.error("[ProfilePage] Failed to prefer passphrase unlock:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "We could not update your preferred unlock method."
      );
    } finally {
      setSwitchingVaultMethod(false);
    }
  }

  async function changePassphrase() {
    if (!user?.uid) return;

    if (!isVaultUnlocked || !vaultKey) {
      toast.info("Unlock your vault to change passphrase.");
      setShowVaultUnlock(true);
      return;
    }

    setSwitchingVaultMethod(true);
    try {
      const result = await VaultMethodService.changePassphrase({
        userId: user.uid,
        currentVaultKey: vaultKey,
        newPassphrase,
        keepPrimaryMethod: true,
      });
      setVaultMethod(result.primaryMethod);
      toast.success("Passphrase updated successfully.");
      await refreshVaultMethodState(user.uid);
      setPassphraseDialogOpen(false);
      setNewPassphrase("");
      setConfirmPassphrase("");
    } catch (error) {
      console.error("[ProfilePage] Failed to update passphrase:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "We could not update your passphrase."
      );
    } finally {
      setSwitchingVaultMethod(false);
    }
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 py-6 md:py-8 md:max-w-2xl space-y-6">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        <Avatar className="h-24 w-24 mx-auto ring-4 ring-primary/20">
          <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "Profile"} />
          <AvatarFallback className="bg-muted text-2xl font-semibold text-muted-foreground">
            {user?.displayName ? (
              user.displayName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
            ) : (
              <Icon icon={User} size={48} />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">{user?.displayName || "User"}</h1>
          <div
            className="inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/35 px-3 py-1.5 text-sm text-muted-foreground"
            title={provider.name}
          >
            {renderProviderIcon()}
            <span className="truncate">{user?.email || "Not available"}</span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Persona
            </p>
            <p className="text-sm text-muted-foreground">
              Switch between Investor and RIA from the role menu in the top app bar.
            </p>
          </div>
        </div>
      </div>

      <ProfileSection
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon icon={RefreshCw} size="md" className="text-primary" />
            </div>
            <span>Marketplace visibility</span>
          </div>
        }
        description="Let RIAs discover your public investor profile in Marketplace. Private financial data remains consent-gated."
      >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">Investor marketplace profile</p>
              <p className="text-xs text-muted-foreground">
                {loadingMarketplaceOptIn
                  ? "Checking visibility..."
                  : marketplaceOptIn
                    ? "Discoverable to RIAs"
                    : "Hidden from marketplace search"}
              </p>
            </div>
            <Button
              variant={marketplaceOptIn ? "blue-gradient" : "none"}
              effect="fade"
              size="sm"
              disabled={loadingMarketplaceOptIn || savingMarketplaceOptIn}
              onClick={() => void handleMarketplaceOptInToggle()}
            >
              {savingMarketplaceOptIn
                ? "Saving..."
                : marketplaceOptIn
                  ? "Hide"
                  : "Turn On"}
            </Button>
          </div>
      </ProfileSection>

      <ProfileSection
        title={
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon icon={Folder} size="md" className="text-primary" />
            </div>
            <span className="truncate">Your profile</span>
          </div>
        }
        description="Signals stored in your world model and used to personalize Kai."
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {hasVault === true ? (
              <Button
                variant="blue-gradient"
                effect="fade"
                size="sm"
                disabled={!canEditKaiPreferences}
                onClick={() => setShowKaiPreferencesSheet(true)}
              >
                Edit Kai Preferences
              </Button>
            ) : null}
            {!loadingDomains ? (
              <Badge variant="secondary" className="text-xs">
                {totalAttributes} signals
              </Badge>
            ) : null}
          </div>
        }
      >
          {loadingDomains ? (
            <div className="flex items-center justify-center py-8">
              <Icon
                icon={Loader2}
                size={32}
                className="animate-spin text-primary"
              />
            </div>
          ) : domains.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {domains.map((domain) => {
                const IconComponent = DOMAIN_ICONS[domain.icon] || DOMAIN_ICONS[domain.key] || Folder;
                return (
                  <button
                    key={domain.key}
                    onClick={() => router.push(ROUTES.KAI_DASHBOARD)}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: `${domain.color}20` }}
                      >
                        <Icon icon={IconComponent} size="md" style={{ color: domain.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                          {domain.displayName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {domain.attributeCount} attribute{domain.attributeCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Icon
                        icon={ChevronRight}
                        size="sm"
                        className="text-muted-foreground group-hover:text-primary transition-colors"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon icon={MessageSquare} size="lg" className="text-primary" />
              </div>
              {hasVault === false ? (
                <>
              <p className="text-sm text-muted-foreground mb-3">
                    Create your vault from import to start building your profile.
                  </p>
                  <Button variant="gradient" size="sm" onClick={() => router.push(ROUTES.KAI_IMPORT)}>
                    Go to Import
                  </Button>
                </>
              ) : hasVault === true && !vaultOwnerToken ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Unlock your Vault to view your profile.
                  </p>
                  <Button
                    variant="none"
                    effect="fade"
                    size="sm"
                    onClick={() => {
                      setVaultUnlockReason("profile_data");
                      setShowVaultUnlock(true);
                    }}
                  >
                    Unlock Vault
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-3">
                    Nothing here yet. Chat with Kai to personalize your profile.
                  </p>
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={() => router.push(ROUTES.KAI_DASHBOARD)}
                  >
                    Open Kai
                  </Button>
                </>
              )}
            </div>
          )}
      </ProfileSection>

      <ProfileSection title="Appearance">
        <div className="py-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Appearance</span>
            <ThemeToggle />
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon icon={MessageSquare} size="md" className="text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span>Privacy and consents</span>
              {pendingConsents > 0 ? <Badge variant="secondary">{pendingConsents}</Badge> : null}
            </div>
          </div>
        }
        description="Review pending approvals and active access from your profile settings."
      >
        <div className="rounded-xl bg-muted/35 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {pendingConsents > 0
                  ? `${pendingConsents} consent request${pendingConsents === 1 ? "" : "s"} waiting`
                  : "Consent center"}
              </p>
              <p className="text-xs text-muted-foreground">
                Open the consent center to approve requests and review current data access.
              </p>
            </div>
            <Button
              variant="none"
              effect="fade"
              size="sm"
              onClick={() => router.push(ROUTES.CONSENTS)}
            >
              Open Consents
            </Button>
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon icon={LifeBuoy} size="md" className="text-primary" />
            </div>
            <span>Support and feedback</span>
          </div>
        }
        description="Send a bug report, ask for help, or reach the developer without leaving your profile."
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                kind: "bug_report" as SupportMessageKind,
                label: "Report bug",
                description: "Broken flow, confusing UI, or something off in the product.",
                icon: Bug,
              },
              {
                kind: "support_request" as SupportMessageKind,
                label: "Get support",
                description: "Need help with onboarding, portfolio data, or account setup.",
                icon: LifeBuoy,
              },
              {
                kind: "developer_reachout" as SupportMessageKind,
                label: "Reach developer",
                description: "Direct product or engineering feedback routed through support.",
                icon: Code2,
              },
            ].map((action) => (
              <button
                key={action.kind}
                type="button"
                onClick={() => openSupportDialog(action.kind)}
                className="rounded-xl bg-muted/35 p-4 text-left transition-colors hover:bg-muted/55"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Icon icon={action.icon} size="md" className="text-primary" />
                </div>
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {action.description}
                </p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Messages are sent from <span className="font-medium">support@hushh.ai</span>.
            In local or test delivery mode, they can be routed to the developer inbox for verification.
          </p>
        </div>
      </ProfileSection>

      <ProfileSection
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon icon={Cloud} size="md" className="text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span>Sync to cloud</span>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Today, your profile is securely managed in the cloud for a seamless experience
            across your devices.
          </p>
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Icon icon={HardDrive} size="sm" className="text-muted-foreground mt-0.5" />
              <p className="text-sm">
                Coming soon: optional on-device storage.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Icon icon={RefreshCw} size="sm" className="text-muted-foreground mt-0.5" />
              <p className="text-sm">
                You will get a <span className="font-semibold">Sync to Cloud</span> toggle to control when
                local updates sync across your devices.
              </p>
            </div>
          </div>
        </div>
      </ProfileSection>

      <ProfileSection
        title={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Icon icon={Fingerprint} size="md" className="text-primary" />
            </div>
            <span>Vault security methods</span>
          </div>
        }
        description="Manage passphrase, passkey, and biometric unlock without changing how your Vault stays protected."
      >
        <div className="space-y-4">
          {hasVault === false && (
            <p className="text-sm text-muted-foreground">
              Create your vault first from import to enable biometric or passkey unlock.
            </p>
          )}

          {hasVault === true && loadingVaultMethod && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon icon={Loader2} size="sm" className="animate-spin" />
              Loading vault method...
            </div>
          )}

          {hasVault === true && !loadingVaultMethod && (
            <>
              <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Current Method
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{readableMethod(vaultMethod)}</p>
                  <Badge variant="secondary">
                    {vaultMethod === "passphrase" ? "Passphrase unlock" : "Quick unlock"}
                  </Badge>
                </div>
                {!isVaultUnlocked && (
                  <p className="text-xs text-muted-foreground">
                    Unlock your Vault to update security methods.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Device Capability
                </p>
                <div className="space-y-1 text-sm">
                  <p>
                    Device biometric:{" "}
                    <span className="font-semibold">
                      {capabilityMatrix?.generatedNativeBiometric ? "Ready" : "Not ready"}
                    </span>
                  </p>
                  <p>
                    Passkey:{" "}
                    <span className="font-semibold">
                      {capabilityMatrix?.generatedWebPrf ? "Ready" : "Not ready"}
                    </span>
                  </p>
                </div>
                {capabilityMatrix?.reason && (
                  <p className="text-xs text-muted-foreground">
                    {toInvestorMessage("VAULT_PASSKEY_ENROLL_REQUIRED")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {vaultMethod === "passphrase" && recommendedQuickMethod && (
                  <Button
                    size="default"
                    disabled={switchingVaultMethod}
                    onClick={() => void switchToQuickMethod(recommendedQuickMethod)}
                  >
                    {switchingVaultMethod ? (
                      <>
                        <Icon icon={Loader2} size="sm" className="mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Icon icon={KeyRound} size="sm" className="mr-2" />
                        Enable {readableQuickMethod(recommendedQuickMethod)}
                      </>
                    )}
                  </Button>
                )}

                {vaultMethod && vaultMethod !== "passphrase" && (
                  <Button
                    variant="blue-gradient"
                    effect="fade"
                    size="default"
                    disabled={switchingVaultMethod}
                    onClick={() => void preferPassphraseUnlock()}
                  >
                    Prefer passphrase unlock
                  </Button>
                )}

                {vaultMethod && (
                  <Button
                    variant="none"
                    effect="fade"
                    size="default"
                    disabled={switchingVaultMethod}
                    onClick={() => setPassphraseDialogOpen(true)}
                  >
                    Change passphrase
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </ProfileSection>

      {/* Sign Out Button */}
      <div className="w-full">
        <Button
          variant="none"
          effect="fade"
          size="default"
          className="w-full justify-center app-critical-action"
          onClick={handleSignOut}
        >
          <Icon icon={LogOut} size="md" className="mr-2" />
          Sign Out
        </Button>
      </div>

      <ProfileSection
        title={
          <div className="flex items-center gap-3 app-critical-title">
            <Icon icon={AlertTriangle} size="md" />
            <span>Danger zone</span>
          </div>
        }
        description="Deleting your account is permanent. All vault records and identity details will be erased."
        surfaceClassName="app-critical-card"
      >
        <div className="pt-1">
          <p className="text-sm text-muted-foreground mb-4">
            This action cannot be undone.
          </p>
          <Button
             variant="none"
             effect="fade"
             size="default"
             onClick={handleDeleteClick}
             disabled={isDeleting}
             className="w-full sm:w-auto app-critical-action"
          >
            {isDeleting ? (
              <>
                <Icon
                  icon={Loader2}
                  size="sm"
                  className="mr-2 animate-spin"
                />
                Deleting...
              </>
            ) : (
              <>
                <Icon icon={Trash2} size="sm" className="mr-2" />
                {deleteButtonLabel}
              </>
            )}
          </Button>
        </div>
      </ProfileSection>

      {/* Unlock Dialog */}
      {hasVault === true && (
        <Dialog open={showVaultUnlock} onOpenChange={setShowVaultUnlock}>
          <DialogContent className="sm:max-w-md p-0 border-none bg-transparent shadow-none">
            <DialogTitle className="sr-only">{unlockDialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              {unlockDialogDescription}
            </DialogDescription>
            {user && (
              <VaultFlow
                user={user}
                onSuccess={() => {
                  setShowVaultUnlock(false);
                  if (vaultUnlockReason === "delete_account") {
                    // Small delay to let closing animation finish before showing confirm
                    setTimeout(() => setShowDeleteConfirm(true), 300);
                    return;
                  }
                  toast.success("Vault unlocked.");
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={passphraseDialogOpen} onOpenChange={setPassphraseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Change passphrase</DialogTitle>
          <DialogDescription>
            Set a new passphrase for Vault unlock. Your passkey and biometric methods stay active.
          </DialogDescription>
          <div className="space-y-3 pt-2">
            <Input
              type="password"
              placeholder="New passphrase (min 8 characters)"
              value={newPassphrase}
              onChange={(event) => setNewPassphrase(event.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirm passphrase"
              value={confirmPassphrase}
              onChange={(event) => setConfirmPassphrase(event.target.value)}
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="none"
                effect="fade"
                size="default"
                onClick={() => setPassphraseDialogOpen(false)}
                disabled={switchingVaultMethod}
              >
                Cancel
              </Button>
              <Button
                size="default"
                disabled={
                  switchingVaultMethod ||
                  newPassphrase.length < 8 ||
                  newPassphrase !== confirmPassphrase
                }
                onClick={() => void changePassphrase()}
              >
                {switchingVaultMethod ? "Saving..." : "Save new passphrase"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{supportKindCopy[supportKind].title}</DialogTitle>
            <DialogDescription>
              {supportKindCopy[supportKind].description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/35 p-3 text-xs text-muted-foreground">
              Routed through <span className="font-medium text-foreground">support@hushh.ai</span>
              {user?.email ? (
                <>
                  {" "}
                  with replies pointing back to{" "}
                  <span className="font-medium text-foreground">{user.email}</span>.
                </>
              ) : (
                "."
              )}
            </div>
            <Input
              value={supportSubject}
              onChange={(event) => setSupportSubject(event.target.value)}
              placeholder="Subject"
              maxLength={140}
            />
            <Textarea
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
              placeholder="What happened, what you expected, and anything else we should know"
              className="min-h-[160px]"
              maxLength={8000}
            />
          </div>
          <DialogFooter>
            <Button
              variant="none"
              effect="fade"
              size="default"
              onClick={() => setSupportDialogOpen(false)}
              disabled={sendingSupportMessage}
            >
              Cancel
            </Button>
            <Button
              size="default"
              onClick={() => void submitSupportMessage()}
              disabled={sendingSupportMessage}
            >
              {sendingSupportMessage ? (
                <>
                  <Icon icon={Loader2} size="sm" className="mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Icon icon={SendHorizontal} size="sm" className="mr-2" />
                  Send message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="app-critical-title flex items-center gap-2">
              <Icon icon={AlertTriangle} size="md" />
              Delete Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove your records from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="default"
              className="app-critical-action opacity-90 transition-opacity hover:opacity-100"
              onClick={(e) => {
                e.preventDefault(); // Prevent auto-closing
                handleDeleteAccount();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {user && canEditKaiPreferences && (
        <KaiPreferencesSheet
          open={showKaiPreferencesSheet}
          onOpenChange={setShowKaiPreferencesSheet}
          userId={user.uid}
          vaultKey={vaultKey as string}
          vaultOwnerToken={vaultOwnerToken as string}
        />
      )}

      {/* Security Footer */}
      <p className="text-center text-xs text-muted-foreground">
        Your records are protected before storage, and only your Vault credentials can unlock them.
      </p>
      
    </div>
  );
}
