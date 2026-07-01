import { NextResponse } from "next/server";
import { runDeadlineReminders } from "../../../../lib/notifications";

// Vercel Cron: Monday + Thursday 09:00 UTC (twice a week to catch both horizons).

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
    const stats = await runDeadlineReminders();
    console.log("[cron/deadline-reminders]", stats);
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[cron/deadline-reminders] fatal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
