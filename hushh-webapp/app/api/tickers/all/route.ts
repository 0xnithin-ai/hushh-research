// app/api/tickers/all/route.ts

/**
 * Public Ticker Universe Proxy
 *
 * Proxies GET to Python backend: GET /api/tickers/all
 *
 * Used by the Kai stock search to preload the full ticker universe once and
 * search locally on the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const backendUrl = getPythonApiUrl();
    const response = await fetch(`${backendUrl}/api/tickers/all`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json().catch(() => []);

    if (!response.ok) {
      return NextResponse.json(
        { error: (data as any)?.detail || "Ticker universe fetch failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Tickers all proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
