import { NextRequest, NextResponse } from "next/server";
import { getPythonApiUrl } from "@/app/api/_utils/backend";

const REQUEST_TIMEOUT_MS = 8000;

export async function POST(request: NextRequest) {
  const url = `${getPythonApiUrl()}/api/app-config/review-mode/session`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = await request.text().catch(() => "");
    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: body || "{}",
    });

    clearTimeout(timeout);

    const payload = await response.json().catch(() => ({}));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    clearTimeout(timeout);
    console.error("[app-config/review-mode/session] proxy failed:", error);
    return NextResponse.json(
      { error: "Reviewer session unavailable" },
      { status: 503 },
    );
  }
}
