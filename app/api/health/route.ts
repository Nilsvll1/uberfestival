import { NextResponse } from "next/server";

// Simple health check for uptime monitors and load-balancer probes.
// Does NOT hit the database — keeps latency near zero and avoids DB connection
// pressure from high-frequency health polling.
export async function GET() {
  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
      },
    }
  );
}
