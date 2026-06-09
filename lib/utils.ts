export type DeadlineStatus = "ok" | "soon" | "urgent" | "expired";

export function formatDeadline(dateStr: string | null | undefined): {
  label: string;
  status: DeadlineStatus;
} | null {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  if (isNaN(deadline.getTime())) return null;

  const now = new Date();
  const diff = Math.ceil(
    (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diff < 0) return { label: "Deadline passée", status: "expired" };
  if (diff === 0) return { label: "Deadline aujourd'hui", status: "urgent" };
  if (diff === 1) return { label: "Deadline demain", status: "urgent" };
  if (diff <= 7) return { label: `dans ${diff} jours`, status: "urgent" };
  if (diff <= 14) return { label: `dans ${diff} jours`, status: "soon" };
  const months = Math.floor(diff / 30);
  if (months >= 1) return { label: `dans ${months} mois`, status: "ok" };
  return { label: `dans ${diff} jours`, status: "ok" };
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
