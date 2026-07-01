/**
 * Notification business logic — all three notification types in one place.
 * Called by /api/cron/* routes (Vercel Cron) and the pipeline via HTTP.
 *
 * Requires: RESEND_API_KEY + supabaseAdmin (service role).
 * Never expose to the client.
 */

import { supabaseAdmin } from "./supabase-admin";
import { emailTemplates, sendEmail } from "./email";
import type { NotificationPrefs } from "./types";

export type NotifStats = { sent: number; skipped: number; errors: number };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoWeek(): string {
  const d = new Date();
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = Math.ceil(((d.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function getEmailMap(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const map = new Map<string, string>();
  const idSet = new Set(userIds);
  for (const u of data.users ?? []) {
    if (idSet.has(u.id) && u.email) map.set(u.id, u.email);
  }
  return map;
}

type ProfileRow = {
  id: string;
  artist_name: string | null;
  primary_genre: string | null;
  country: string | null;
  notification_prefs: NotificationPrefs | null;
};

type FestivalRow = {
  id: number;
  festival_name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  submission_deadline: string | null;
  application_status: string | null;
};

// ── 1. Reopening alerts ───────────────────────────────────────────────────────
// Sent when a festival that was saved by a user got its submission_deadline
// updated in the last 49 hours and that deadline is in the future.
// Dedup window: 30 days per (user, festival) pair.

export async function runReopeningAlerts(): Promise<NotifStats> {
  const stats: NotifStats = { sent: 0, skipped: 0, errors: 0 };
  const cutoff = new Date(Date.now() - 49 * 3600 * 1000).toISOString();
  const todayStr = today();

  // Festivals updated recently with a live future deadline.
  const { data: recentFestivals } = await supabaseAdmin
    .from("festivals")
    .select("id, festival_name, city, country, category, submission_deadline, application_status")
    .gte("updated_at", cutoff)
    .not("submission_deadline", "is", null)
    .gte("submission_deadline", todayStr)
    .not("application_status", "in", '("seasonally_closed","unknown","invitation_only")');

  if (!recentFestivals?.length) return stats;

  const festivalIds = recentFestivals.map(f => f.id);

  // Users who saved these festivals.
  const { data: savedPairs } = await supabaseAdmin
    .from("saved_festivals")
    .select("user_id, festival_id")
    .in("festival_id", festivalIds);

  if (!savedPairs?.length) return stats;

  const allUserIds = [...new Set(savedPairs.map(p => p.user_id))];

  // Profiles + emails in parallel.
  const [emailMap, profilesResult, logResult] = await Promise.all([
    getEmailMap(allUserIds),
    supabaseAdmin
      .from("profiles")
      .select("id, artist_name, notification_prefs")
      .in("id", allUserIds),
    supabaseAdmin
      .from("notification_log")
      .select("user_id, festival_id")
      .eq("type", "reopening_alert")
      .gte("sent_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString()),
  ]);

  const profileMap = new Map(
    (profilesResult.data ?? []).map(p => [p.id, p as ProfileRow])
  );
  const alreadySent = new Set(
    (logResult.data ?? []).map(l => `${l.user_id}:${l.festival_id}`)
  );

  // Group saved pairs by festival_id.
  const byFestival = new Map<number, string[]>();
  for (const pair of savedPairs) {
    const list = byFestival.get(pair.festival_id) ?? [];
    list.push(pair.user_id);
    byFestival.set(pair.festival_id, list);
  }

  for (const festival of recentFestivals as FestivalRow[]) {
    const users = byFestival.get(festival.id) ?? [];
    for (const userId of users) {
      const key = `${userId}:${festival.id}`;
      const profile = profileMap.get(userId);
      const email = emailMap.get(userId);

      if (!email || !profile) { stats.skipped++; continue; }
      if (profile.notification_prefs?.email_reopening_alerts === false) {
        stats.skipped++;
        continue;
      }
      if (alreadySent.has(key)) { stats.skipped++; continue; }

      try {
        const tmpl = emailTemplates.reopeningAlert(festival, profile.artist_name);
        await sendEmail({ to: email, ...tmpl });
        await supabaseAdmin.from("notification_log").insert({
          user_id: userId,
          type: "reopening_alert",
          festival_id: festival.id,
        });
        alreadySent.add(key);
        stats.sent++;
      } catch (err) {
        console.error(`[notify] reopening_alert user=${userId} festival=${festival.id}:`, err);
        stats.errors++;
      }
    }
  }

  return stats;
}

// ── 2. Weekly digest ──────────────────────────────────────────────────────────
// Sent once per ISO week to users with email_new_opportunities = true.
// Festivals are matched by the user's primary_genre and country when set.

export async function runWeeklyDigest(): Promise<NotifStats> {
  const stats: NotifStats = { sent: 0, skipped: 0, errors: 0 };
  const week = isoWeek();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const todayStr = today();

  // New festivals from last 7 days with live deadlines.
  const { data: newFestivals } = await supabaseAdmin
    .from("festivals")
    .select("id, festival_name, city, country, category, submission_deadline, application_status")
    .gte("created_at", sevenDaysAgo)
    .not("submission_deadline", "is", null)
    .gte("submission_deadline", todayStr)
    .not("application_status", "in", '("seasonally_closed","unknown")')
    .order("created_at", { ascending: false })
    .limit(60);

  if (!newFestivals?.length) return stats;

  // Profiles with the new-opportunities pref (and at least an account).
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, artist_name, primary_genre, country, notification_prefs");

  const targets = (profiles ?? []).filter(
    p => (p.notification_prefs as NotificationPrefs | null)?.email_new_opportunities === true
  ) as ProfileRow[];

  if (!targets.length) return stats;

  const targetIds = targets.map(p => p.id);

  // Which users already got this week's digest?
  const { data: sentThisWeek } = await supabaseAdmin
    .from("notification_log")
    .select("user_id")
    .eq("type", "weekly_digest")
    .gte("sent_at", new Date(Date.now() - 8 * 86400 * 1000).toISOString());

  const alreadySent = new Set((sentThisWeek ?? []).map(l => l.user_id));

  const emailMap = await getEmailMap(targetIds);

  for (const profile of targets) {
    if (alreadySent.has(profile.id)) { stats.skipped++; continue; }
    const email = emailMap.get(profile.id);
    if (!email) { stats.skipped++; continue; }

    // Genre + country targeting.
    let matches = newFestivals as FestivalRow[];
    if (profile.primary_genre) {
      const byGenre = matches.filter(f => f.category === profile.primary_genre);
      if (byGenre.length >= 3) matches = byGenre;
    }
    if (profile.country) {
      const byCountry = matches.filter(f => f.country === profile.country);
      if (byCountry.length >= 2) {
        // Prioritise country matches at the top.
        const rest = matches.filter(f => f.country !== profile.country);
        matches = [...byCountry, ...rest];
      }
    }

    if (matches.length === 0) { stats.skipped++; continue; }

    try {
      const tmpl = emailTemplates.weeklyDigest(matches.slice(0, 7), profile.artist_name, matches.length);
      await sendEmail({ to: email, ...tmpl });
      await supabaseAdmin.from("notification_log").insert({
        user_id: profile.id,
        type: "weekly_digest",
        context: { week },
      });
      alreadySent.add(profile.id);
      stats.sent++;
    } catch (err) {
      console.error(`[notify] weekly_digest user=${profile.id}:`, err);
      stats.errors++;
    }
  }

  return stats;
}

// ── 3. Deadline reminders ─────────────────────────────────────────────────────
// Sent at two horizons: 14 days before and 3 days before a saved festival's
// deadline. Dedup per (user, festival, horizon) within a 9-day window.

export async function runDeadlineReminders(): Promise<NotifStats> {
  const stats: NotifStats = { sent: 0, skipped: 0, errors: 0 };
  const HORIZONS = [14, 3];

  for (const daysLeft of HORIZONS) {
    // Allow ±1 day window so a delayed cron doesn't cause missed reminders.
    const lo = addDays(daysLeft - 1);
    const hi = addDays(daysLeft + 1);

    const { data: festivals } = await supabaseAdmin
      .from("festivals")
      .select("id, festival_name, city, country, category, submission_deadline, application_status")
      .gte("submission_deadline", lo)
      .lte("submission_deadline", hi)
      .not("application_status", "in", '("seasonally_closed","unknown","invitation_only")');

    if (!festivals?.length) continue;

    const festivalIds = festivals.map(f => f.id);

    const { data: savedPairs } = await supabaseAdmin
      .from("saved_festivals")
      .select("user_id, festival_id")
      .in("festival_id", festivalIds);

    if (!savedPairs?.length) continue;

    const allUserIds = [...new Set(savedPairs.map(p => p.user_id))];

    const [emailMap, profilesResult, logResult] = await Promise.all([
      getEmailMap(allUserIds),
      supabaseAdmin
        .from("profiles")
        .select("id, artist_name, notification_prefs")
        .in("id", allUserIds),
      supabaseAdmin
        .from("notification_log")
        .select("user_id, festival_id, context")
        .eq("type", "deadline_reminder")
        .gte("sent_at", new Date(Date.now() - 9 * 86400 * 1000).toISOString()),
    ]);

    const profileMap = new Map(
      (profilesResult.data ?? []).map(p => [p.id, p as ProfileRow])
    );

    // Dedup key: user:festival:horizon
    const alreadySent = new Set(
      (logResult.data ?? []).map(
        l => `${l.user_id}:${l.festival_id}:${(l.context as { horizon?: number } | null)?.horizon}`
      )
    );

    const byFestival = new Map<number, string[]>();
    for (const pair of savedPairs) {
      const list = byFestival.get(pair.festival_id) ?? [];
      list.push(pair.user_id);
      byFestival.set(pair.festival_id, list);
    }

    for (const festival of festivals as FestivalRow[]) {
      const users = byFestival.get(festival.id) ?? [];
      for (const userId of users) {
        const dupKey = `${userId}:${festival.id}:${daysLeft}`;
        const profile = profileMap.get(userId);
        const email = emailMap.get(userId);

        if (!email || !profile) { stats.skipped++; continue; }
        if (profile.notification_prefs?.email_deadlines === false) {
          stats.skipped++;
          continue;
        }
        if (alreadySent.has(dupKey)) { stats.skipped++; continue; }

        try {
          const tmpl = emailTemplates.deadlineReminder(festival, daysLeft, profile.artist_name);
          await sendEmail({ to: email, ...tmpl });
          await supabaseAdmin.from("notification_log").insert({
            user_id: userId,
            type: "deadline_reminder",
            festival_id: festival.id,
            context: { horizon: daysLeft },
          });
          alreadySent.add(dupKey);
          stats.sent++;
        } catch (err) {
          console.error(`[notify] deadline_reminder user=${userId} festival=${festival.id} horizon=${daysLeft}:`, err);
          stats.errors++;
        }
      }
    }
  }

  return stats;
}
