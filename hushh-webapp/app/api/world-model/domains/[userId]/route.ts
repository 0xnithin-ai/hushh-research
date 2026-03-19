// app/api/world-model/domains/[userId]/route.ts
/**
 * User Domains API Route (Web Proxy)
 * 
 * Tri-Flow Layer: Web Proxy (Next.js API route for web platform)
 * Proxies to Python backend: GET /api/world-model/domains/{userId}
 */

import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

const BACKEND_URL = getPythonApiUrl();

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId;

    const response = await fetch(
      `${BACKEND_URL}/api/world-model/domains/${userId}`,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user domains" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[world-model/domains/userId] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
