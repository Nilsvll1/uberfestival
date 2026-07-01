import { NextResponse } from "next/server";
import { runReopeningAlerts } from "../../../../lib/notifications";

// Called by Vercel Cron (Monday 10:00 UTC) and by the scraper pipeline after each run.
// Protected by CRON_SECRET in the Authorization header.

export const maxDuration = 60;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runReopeningAlerts();
    console.log("[cron/reopening-alerts]", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[cron/reopening-alerts] fatal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
