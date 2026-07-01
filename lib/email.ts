import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export const FROM_EMAIL =
  process.env.FROM_EMAIL ?? "UberFestival <notifications@uberfestival.com>";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://uberfestival.com";

// ── Shared HTML primitives ────────────────────────────────────────────────────

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:28px 16px 40px;">
  <div style="background:linear-gradient(135deg,#6366F1 0%,#4F46E5 100%);border-radius:14px 14px 0 0;padding:18px 28px;">
    <span style="color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.04em;">UberFestival</span>
  </div>
  <div style="background:#fff;padding:28px;border-radius:0 0 14px 14px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
    ${body}
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid #F0F0F3;">
      <p style="margin:0;font-size:11.5px;color:#9CA3AF;line-height:1.65;">
        You received this because you have email notifications enabled.<br>
        <a href="${SITE}/dashboard/privacy" style="color:#6366F1;text-decoration:none;">Manage preferences →</a>
      </p>
    </div>
  </div>
</div>
</body>
</html>`;
}

function cta(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:18px;background:#6366F1;color:#fff;font-size:13.5px;font-weight:600;text-decoration:none;padding:10px 22px;border-radius:10px;">${label}</a>`;
}

type FestivalSnippet = {
  id: number;
  festival_name: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
  submission_deadline?: string | null;
};

function formatDate(iso?: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function festivalRow(f: FestivalSnippet): string {
  const loc = [f.city, f.country].filter(Boolean).join(", ");
  return `<div style="border:1px solid #E5E7EB;border-radius:10px;padding:13px 16px;margin-bottom:10px;">
  <p style="margin:0;font-size:13.5px;font-weight:600;color:#111;letter-spacing:-0.02em;">${f.festival_name}</p>
  <p style="margin:3px 0 0;font-size:12px;color:#6B7280;">${loc}${f.category ? ` · ${f.category}` : ""}</p>
  <p style="margin:3px 0 0;font-size:12px;color:#9CA3AF;">Deadline: <strong style="color:#374151;">${formatDate(f.submission_deadline)}</strong></p>
  <a href="${SITE}/festival/${f.id}" style="display:inline-block;font-size:12.5px;color:#6366F1;font-weight:600;text-decoration:none;margin-top:7px;">View &amp; Apply →</a>
</div>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const emailTemplates = {
  reopeningAlert(
    festival: FestivalSnippet,
    artistName?: string | null
  ): { subject: string; html: string; text: string } {
    const greeting = artistName ? `Hi ${artistName}` : "Hi there";
    const deadline = formatDate(festival.submission_deadline);
    const html = shell(`
      <p style="margin:0 0 6px;font-size:11.5px;font-weight:700;letter-spacing:0.06em;color:#6366F1;text-transform:uppercase;">Reopening Alert</p>
      <h1 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#111;letter-spacing:-0.04em;">
        ${festival.festival_name} is now accepting applications
      </h1>
      <p style="margin:0 0 20px;font-size:13.5px;color:#374151;line-height:1.6;">
        ${greeting} — a festival you saved has reopened for applications.
      </p>
      ${festivalRow(festival)}
      ${festival.submission_deadline ? `<p style="margin:10px 0 0;font-size:12.5px;font-weight:600;color:#DC2626;">⏰ Application deadline: ${deadline}</p>` : ""}
      ${cta("View Festival →", `${SITE}/festival/${festival.id}`)}
    `);
    const text = [
      `${festival.festival_name} is now open for applications!`,
      `Location: ${[festival.city, festival.country].filter(Boolean).join(", ")}`,
      festival.submission_deadline ? `Deadline: ${deadline}` : null,
      ``,
      `${SITE}/festival/${festival.id}`,
      ``,
      `Manage preferences: ${SITE}/dashboard/privacy`,
    ].filter(l => l !== null).join("\n");
    return {
      subject: `🔔 ${festival.festival_name} is open for applications`,
      html,
      text,
    };
  },

  weeklyDigest(
    festivals: FestivalSnippet[],
    artistName?: string | null,
    totalCount?: number
  ): { subject: string; html: string; text: string } {
    const greeting = artistName ? `Hi ${artistName}` : "Hi there";
    const count = totalCount ?? festivals.length;
    const shown = festivals.slice(0, 7);
    const html = shell(`
      <p style="margin:0 0 6px;font-size:11.5px;font-weight:700;letter-spacing:0.06em;color:#6366F1;text-transform:uppercase;">Weekly Digest</p>
      <h1 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#111;letter-spacing:-0.04em;">
        ${count} new opportunit${count !== 1 ? "ies" : "y"} this week
      </h1>
      <p style="margin:0 0 20px;font-size:13.5px;color:#374151;line-height:1.6;">
        ${greeting} — here are the latest festivals matching your interests.
      </p>
      ${shown.map(festivalRow).join("")}
      ${count > shown.length ? `<p style="margin:8px 0 0;font-size:12.5px;color:#9CA3AF;">+ ${count - shown.length} more on UberFestival</p>` : ""}
      ${cta("Explore all festivals →", `${SITE}/explore`)}
    `);
    const text = [
      `${count} new festival opportunit${count !== 1 ? "ies" : "y"} this week:`,
      ``,
      ...shown.map(
        f =>
          `• ${f.festival_name} (${[f.city, f.country].filter(Boolean).join(", ")})` +
          (f.submission_deadline ? ` — deadline ${formatDate(f.submission_deadline)}` : "") +
          `\n  ${SITE}/festival/${f.id}`
      ),
      ``,
      `See all: ${SITE}/explore`,
      `Manage preferences: ${SITE}/dashboard/privacy`,
    ].join("\n");
    return {
      subject: `🎵 ${count} new festival opportunit${count !== 1 ? "ies" : "y"} for you this week`,
      html,
      text,
    };
  },

  deadlineReminder(
    festival: FestivalSnippet,
    daysLeft: number,
    artistName?: string | null
  ): { subject: string; html: string; text: string } {
    const greeting = artistName ? `Hi ${artistName}` : "Hi there";
    const urgent = daysLeft <= 3;
    const html = shell(`
      <p style="margin:0 0 6px;font-size:11.5px;font-weight:700;letter-spacing:0.06em;color:${urgent ? "#DC2626" : "#6366F1"};text-transform:uppercase;">Deadline Reminder</p>
      <h1 style="margin:0 0 10px;font-size:19px;font-weight:800;color:#111;letter-spacing:-0.04em;">
        ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to apply
      </h1>
      <p style="margin:0 0 20px;font-size:13.5px;color:#374151;line-height:1.6;">
        ${greeting} — the application deadline is approaching for a festival you've saved.
      </p>
      ${festivalRow(festival)}
      ${urgent ? `<p style="margin:10px 0 0;font-size:12.5px;font-weight:600;color:#DC2626;">⚠️ Only ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left — don't miss it!</p>` : ""}
      ${cta("Apply Now →", `${SITE}/festival/${festival.id}`)}
    `);
    const text = [
      `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to apply to ${festival.festival_name}`,
      `Deadline: ${formatDate(festival.submission_deadline)}`,
      ``,
      `${SITE}/festival/${festival.id}`,
      ``,
      `Manage preferences: ${SITE}/dashboard/privacy`,
    ].join("\n");
    const urgencyEmoji = urgent ? "⚠️" : "⏰";
    return {
      subject: `${urgencyEmoji} ${festival.festival_name} — ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left to apply`,
      html,
      text,
    };
  },
};

// ── Send wrapper ──────────────────────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!resend) {
    console.log(`[email] RESEND_API_KEY not set — skipping "${opts.subject}" to ${opts.to}`);
    return;
  }
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) throw new Error(`Resend: ${(error as { message?: string }).message ?? String(error)}`);
}
