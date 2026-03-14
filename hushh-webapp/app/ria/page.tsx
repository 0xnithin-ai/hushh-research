"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MetricTile,
  RiaCompatibilityState,
  RiaPageShell,
  RiaStatusPanel,
  RiaSurface,
} from "@/components/ria/ria-page-shell";
import { SectionHeader } from "@/components/app-ui/page-sections";
import { useAuth } from "@/hooks/use-auth";
import { usePersonaState } from "@/lib/persona/persona-context";
import { ROUTES } from "@/lib/navigation/routes";
import {
  isIAMSchemaNotReadyError,
  RiaService,
  type RiaClientAccess,
  type RiaInviteRecord,
  type RiaOnboardingStatus,
  type RiaRequestRecord,
} from "@/lib/services/ria-service";

function describeRequestAction(action: string) {
  switch (action) {
    case "REQUESTED":
      return "Awaiting investor review";
    case "CONSENT_GRANTED":
      return "Consent granted";
    case "CONSENT_DENIED":
      return "Consent denied";
    case "CANCELLED":
      return "Request cancelled";
    case "REVOKED":
      return "Consent revoked";
    case "TIMEOUT":
      return "Request expired";
    default:
      return action;
  }
}

function formatVerificationStatus(status?: string | null, loading?: boolean) {
  if (loading) return "Loading";
  switch (status) {
    case "finra_verified":
      return "FINRA verified";
    case "active":
      return "Active";
    case "submitted":
      return "Submitted";
    case "rejected":
      return "Rejected";
    case "draft":
    default:
      return "Draft";
  }
}

function verificationTone(status?: string | null): "neutral" | "warning" | "success" | "critical" {
  switch (status) {
    case "active":
    case "finra_verified":
      return "success";
    case "submitted":
      return "warning";
    case "rejected":
      return "critical";
    case "draft":
    default:
      return "neutral";
  }
}

export default function RiaHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { riaCapability, riaOnboardingStatus } = usePersonaState();
  const [status, setStatus] = useState<RiaOnboardingStatus | null>(null);
  const [clients, setClients] = useState<RiaClientAccess[]>([]);
  const [requests, setRequests] = useState<RiaRequestRecord[]>([]);
  const [invites, setInvites] = useState<RiaInviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [iamUnavailable, setIamUnavailable] = useState(false);

  useEffect(() => {
    if (riaCapability === "setup") {
      router.replace(ROUTES.RIA_ONBOARDING);
      return;
    }
  }, [riaCapability, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (riaCapability === "setup") {
        setLoading(false);
        return;
      }
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setIamUnavailable(false);
        const idToken = await user.getIdToken();
        const [nextStatus, nextClients, nextRequests, nextInvites] = await Promise.all([
          RiaService.getOnboardingStatus(idToken),
          RiaService.listClients(idToken),
          RiaService.listRequests(idToken),
          RiaService.listInvites(idToken),
        ]);
        if (cancelled) return;
        setStatus(nextStatus);
        setClients(nextClients);
        setRequests(nextRequests);
        setInvites(nextInvites);
      } catch (error) {
        if (!cancelled) {
          setStatus(null);
          setClients([]);
          setRequests([]);
          setInvites([]);
          setIamUnavailable(isIAMSchemaNotReadyError(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [riaCapability, user]);

  const metrics = useMemo(() => {
    const activeClients = clients.filter((item) => item.status === "approved").length;
    const pendingRequests = requests.filter((item) => item.action === "REQUESTED").length;
    const openInvites = invites.filter((item) => item.status === "sent").length;
    return {
      activeClients,
      pendingRequests,
      openInvites,
      totalRelationships: clients.length.toString(),
    };
  }, [clients, invites, requests]);

  return (
    <RiaPageShell
      eyebrow="Advisor Workspace"
      title="A consent-first operating system for client relationships"
      description="Verification, requests, client workspace access, and marketplace discovery live in one RIA shell. Private data stays gated until consent is active."
      statusPanel={
        iamUnavailable ? null : (
          <RiaStatusPanel
            title="Verification and access state"
            description="Keep the trust posture visible before the user scans metrics or workflow modules."
            items={[
              {
                label: "Verification",
                value: formatVerificationStatus(
                  (status || riaOnboardingStatus)?.verification_status,
                  loading
                ),
                helper:
                  (status || riaOnboardingStatus)?.verification_status === "active" ||
                  (status || riaOnboardingStatus)?.verification_status === "finra_verified"
                    ? "Requests and workspace access are available"
                    : "Consent requests remain gated until trusted status is reached",
                tone: verificationTone((status || riaOnboardingStatus)?.verification_status),
              },
              {
                label: "Active clients",
                value: loading ? "..." : String(metrics.activeClients),
                helper: "Approved relationships",
                tone: metrics.activeClients > 0 ? "success" : "neutral",
              },
              {
                label: "Pending requests",
                value: loading ? "..." : String(metrics.pendingRequests),
                helper: "Awaiting investor review",
                tone: metrics.pendingRequests > 0 ? "warning" : "neutral",
              },
              {
                label: "Open invites",
                value: loading ? "..." : String(metrics.openInvites),
                helper: "Shared but not yet accepted",
                tone: metrics.openInvites > 0 ? "warning" : "neutral",
              },
            ]}
          />
        )
      }
      actions={
        <>
          <Link
            href={ROUTES.RIA_CLIENTS}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background"
          >
            Import or invite clients
          </Link>
          <Link
            href={ROUTES.MARKETPLACE}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-border/70 bg-background/60 px-4 text-sm font-medium text-foreground"
          >
            Browse marketplace investors
          </Link>
        </>
      }
    >
      {iamUnavailable ? (
        <RiaCompatibilityState
          title="RIA mode is not active in this environment yet"
          description="The connected database is still in investor compatibility mode. The shell is in place, but onboarding, marketplace, and client workspaces stay unavailable until IAM migrations pass."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile
          label="Active Clients"
          value={loading ? "..." : String(metrics.activeClients)}
          helper="Approved relationships"
        />
        <MetricTile
          label="Pending Requests"
          value={loading ? "..." : String(metrics.pendingRequests)}
          helper="Awaiting investor decision"
        />
        <MetricTile
          label="Open Invites"
          value={loading ? "..." : String(metrics.openInvites)}
          helper="Shared but not yet accepted"
        />
        <MetricTile
          label="Relationships"
          value={loading ? "..." : metrics.totalRelationships}
          helper="Total tracked connections"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Next Best Action"
            title={
              (status || riaOnboardingStatus)?.verification_status === "active" ||
              (status || riaOnboardingStatus)?.verification_status === "finra_verified"
                ? "Start the next client conversation"
                : "Complete verification and profile setup"
            }
            description={
              (status || riaOnboardingStatus)?.verification_status === "active" ||
              (status || riaOnboardingStatus)?.verification_status === "finra_verified"
                ? "Use the client roster to send invites, move pending relationships forward, and reopen revoked or expired access."
                : "RIA access requests remain blocked until verification reaches a trusted state. Finish onboarding, confirm your firm data, and enable marketplace discoverability from the RIA dashboard."
            }
            actions={
              <Link
                href={
                  (status || riaOnboardingStatus)?.verification_status === "active" ||
                  (status || riaOnboardingStatus)?.verification_status === "finra_verified"
                    ? ROUTES.RIA_CLIENTS
                    : ROUTES.RIA_ONBOARDING
                }
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 px-4 text-sm font-medium text-primary"
              >
                {(status || riaOnboardingStatus)?.verification_status === "active" ||
                (status || riaOnboardingStatus)?.verification_status === "finra_verified"
                  ? "Open clients"
                  : "Resume onboarding"}
              </Link>
            }
          />
        </section>

        <section className="space-y-3">
          <SectionHeader
            eyebrow="Activity"
            title="Recent request movement"
            description="Keep the latest consent and request outcomes visible without burying them inside the roster."
          />
          <RiaSurface>
            <div className="space-y-3">
              {requests.slice(0, 4).map((item) => (
                <div
                  key={item.request_id}
                  className="rounded-2xl border border-border/50 bg-background/60 p-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {item.subject_display_name || "Investor"} · {describeRequestAction(item.action)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.subject_headline || item.scope}
                  </p>
                </div>
              ))}
              {!loading && requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No request activity yet. Start from clients or marketplace.
                </p>
              ) : null}
            </div>
          </RiaSurface>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Client roster"
            title="Latest relationship states"
            actions={
              <Link href={ROUTES.RIA_CLIENTS} className="text-sm font-medium text-primary">
                View all
              </Link>
            }
          />
          <RiaSurface>
            <div className="space-y-3">
              {clients.slice(0, 4).map((client) => (
                <div
                  key={client.id}
                  className="rounded-2xl border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {client.investor_display_name || client.investor_user_id || "Invited investor"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {client.status} · {client.next_action || "request_access"}
                      </p>
                    </div>
                    {client.investor_user_id ? (
                      <Link
                        href={`/ria/workspace/${encodeURIComponent(client.investor_user_id)}`}
                        className="text-xs font-medium text-foreground/75"
                      >
                        Workspace
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
              {!loading && clients.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active client relationships yet.
                </p>
              ) : null}
            </div>
          </RiaSurface>
        </section>

        <section className="space-y-3">
          <SectionHeader
            eyebrow="Invite pipeline"
            title="Shared, accepted, and pending"
            actions={
              <Link href={ROUTES.RIA_REQUESTS} className="text-sm font-medium text-primary">
                View activity
              </Link>
            }
          />
          <RiaSurface>
            <div className="space-y-3">
              {invites.slice(0, 4).map((invite) => (
                <div
                  key={invite.invite_id}
                  className="rounded-2xl border border-border/50 bg-background/60 p-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {invite.target_display_name || invite.target_email || invite.target_phone || "Share link"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {invite.status} · {invite.delivery_channel || "share_link"}
                  </p>
                </div>
              ))}
              {!loading && invites.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No invites sent yet.
                </p>
              ) : null}
            </div>
          </RiaSurface>
        </section>
      </div>
    </RiaPageShell>
  );
}
