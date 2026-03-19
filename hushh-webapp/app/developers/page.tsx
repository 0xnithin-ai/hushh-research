import { headers } from "next/headers";

import { DeveloperDocsHub } from "@/components/developers/developer-docs-hub";

function resolveRequestOrigin(host: string | null, protocol: string | null) {
  if (!host) {
    return null;
  }

  const normalizedProtocol =
    protocol ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${normalizedProtocol}://${host}`;
}

export default async function DevelopersPage() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto");
  const initialOrigin = resolveRequestOrigin(host, protocol);

  return <DeveloperDocsHub initialOrigin={initialOrigin} />;
}
