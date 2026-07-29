import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const API_SECRET = process.env.API_SECRET || "reachinbox-dev-secret-2024";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Proxy all /api/proxy/* requests to the backend.
 * Adds the API secret header automatically.
 * Requires valid NextAuth session.
 */
async function handler(req: NextRequest, context: RouteContext) {
  // Check session
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  const pathStr = path.join("/");
  const url = new URL(req.url);
  const backendUrl = `${BACKEND_URL}/api/${pathStr}${url.search}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-api-secret": API_SECRET,
  };

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  try {
    const backendRes = await fetch(backendUrl, {
      method: req.method,
      headers,
      body,
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.json(
      { error: "Backend unavailable" },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
