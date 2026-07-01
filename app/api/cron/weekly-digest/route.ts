import { NextResponse } from "next/server";
import { runWeeklyDigest } from "../../../../lib/notifications";

// Vercel Cron: Monday 10:30 UTC (after reopening-alerts and after the pipeline has run).

export const maxDuration = 120;

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runWeeklyDigest();
    console.log("[cron/weekly-digest]", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[cron/weekly-digest] fatal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
