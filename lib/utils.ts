import type { Language } from "./i18n/types";
import type { Festival } from "./types";

export type ApplicationStatus =
  | "verified_application"
  | "email_submission"
  | "filmfreeway"
  | "festhome"
  | "contact_form"
  | "contact_submission"
  | "invitation_only"
  | "seasonally_closed"
  | "unknown";

const APPLY_NOW_STATUSES = new Set<ApplicationStatus>([
  "verified_application",
  "filmfreeway",
  "festhome",
  "email_submission",
  "contact_form",
]);

export function isApplyNowStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return APPLY_NOW_STATUSES.has(status as ApplicationStatus);
}

export type DeadlineStatus = "ok" | "soon" | "urgent" | "expired";

/* ── Urgency grouping ──────────────────────────────────────── */
export type UrgencyGroup = "this-week" | "this-month" | "upcoming" | "no-deadline" | "expired";

export function getUrgencyGroup(
  deadline: string | null | undefined,
  today?: string
): UrgencyGroup {
  if (!deadline) return "no-deadline";
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const dl = deadline.slice(0, 10);
  if (dl < todayStr) return "expired";
  const daysLeft = Math.round(
    (new Date(dl).getTime() - new Date(todayStr).getTime()) / 86400000
  );
  if (daysLeft <= 7)  return "this-week";
  if (daysLeft <= 30) return "this-month";
  return "upcoming";
}

/* ── Opportunity score (0–100) ─────────────────────────────── */
export type ScoreTier = "hot" | "strong" | "good" | "limited";

export function getOpportunityScore(festival: Festival): {
  score: number;
  tier:  ScoreTier;
  color: string;
  bg:    string;
} {
  let score = 0;

  // Actionability (0–35): can the artist actually apply?
  if (festival.application_url) score += 35;

  // Urgency / timing (0–35)
  if (festival.submission_deadline) {
    const today = new Date().toISOString().slice(0, 10);
    const dl    = festival.submission_deadline.slice(0, 10);
    if (dl >= today) {
      const days = Math.round((new Date(dl).getTime() - new Date(today).getTime()) / 86400000);
      if (days <= 7)  score += 35;
      else if (days <= 30) score += 25;
      else if (days <= 90) score += 15;
      else score += 8;
    }
    // expired deadline: +0 (urgency gone, completeness still counts)
  }

  // Completeness (0–30)
  if (festival.city)        score += 8;
  if (festival.country)     score += 8;
  if (festival.category)    score += 7;
  if (festival.description) score += 7;

  score = Math.min(100, score);

  if (score >= 75) return { score, tier: "hot",     color: "#DC2626", bg: "rgba(220,38,38,0.10)"  };
  if (score >= 55) return { score, tier: "strong",  color: "#D97706", bg: "rgba(217,119,6,0.10)"  };
  if (score >= 35) return { score, tier: "good",    color: "#16A34A", bg: "rgba(22,163,74,0.10)"  };
  return                   { score, tier: "limited", color: "#9CA3AF", bg: "rgba(0,0,0,0.06)"     };
}

export function formatDeadline(
  dateStr: string | null | undefined,
  lang: Language = "en"
): { label: string; status: DeadlineStatus } | null {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  if (isNaN(deadline.getTime())) return null;

  const now = new Date();
  const diff = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const fr = lang === "fr";

  if (diff < 0)  return { label: fr ? "Deadline passée"       : "Deadline passed",    status: "expired" };
  if (diff === 0) return { label: fr ? "Deadline aujourd'hui"  : "Deadline today",     status: "urgent"  };
  if (diff === 1) return { label: fr ? "Deadline demain"       : "Tomorrow",           status: "urgent"  };
  if (diff <= 7)  return { label: fr ? `dans ${diff} jours`    : `${diff} days left`,  status: "urgent"  };
  if (diff <= 14) return { label: fr ? `dans ${diff} jours`    : `in ${diff} days`,    status: "soon"    };

  const months = Math.floor(diff / 30);
  if (months >= 1) return {
    label: fr ? `dans ${months} mois` : `in ${months} month${months > 1 ? "s" : ""}`,
    status: "ok",
  };
  return {
    label: fr ? `dans ${diff} jours` : `in ${diff} days`,
    status: "ok",
  };
}

const GENRE_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "#EDE9FE", text: "#7C3AED" },
  { bg: "#DBEAFE", text: "#2563EB" },
  { bg: "#FCE7F3", text: "#DB2777" },
  { bg: "#D1FAE5", text: "#059669" },
  { bg: "#FEF3C7", text: "#D97706" },
  { bg: "#FEE2E2", text: "#DC2626" },
  { bg: "#E0F2FE", text: "#0284C7" },
  { bg: "#F0FDF4", text: "#16A34A" },
];

export function genreColor(genre: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = (hash * 31 + genre.charCodeAt(i)) % 1000;
  }
  return GENRE_PALETTE[Math.abs(hash) % GENRE_PALETTE.length];
}
