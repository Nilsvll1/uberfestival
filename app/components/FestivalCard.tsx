import type { Festival } from "../../lib/types";
import { formatDeadline, genreColor } from "../../lib/utils";

const deadlineStyles: Record<string, string> = {
  ok: "#059669",
  soon: "#D97706",
  urgent: "#DC2626",
  expired: "var(--text-muted)",
};

export default function FestivalCard({ festival }: { festival: Festival }) {
  const deadline = formatDeadline(festival.submission_deadline);
  const color = festival.category ? genreColor(festival.category) : null;

  return (
    <div
      className="group bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-all"
      style={{
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Badge + favori */}
      <div className="flex items-center justify-between gap-2 min-h-[24px]">
        {color && festival.category ? (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: color.bg, color: color.text }}
          >
            {festival.category}
          </span>
        ) : (
          <span />
        )}
        <button
          className="text-base leading-none transition-all opacity-0 group-hover:opacity-100"
          style={{ color: "var(--text-muted)" }}
          aria-label="Sauvegarder"
        >
          ♡
        </button>
      </div>

      {/* Nom + localisation */}
      <div className="flex flex-col gap-0.5">
        <h3
          className="font-semibold leading-snug"
          style={{ fontSize: "15px", color: "var(--text-primary)" }}
        >
          {festival.festival_name}
        </h3>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {[festival.city, festival.country].filter(Boolean).join(", ")}
        </p>
      </div>

      {/* Séparateur */}
      <div style={{ borderTop: "1px solid var(--border)" }} />

      {/* Deadline + CTA */}
      <div className="flex items-center justify-between gap-3">
        {deadline ? (
          <span
            className="text-xs font-medium"
            style={{
              color: deadlineStyles[deadline.status],
              textDecoration: deadline.status === "expired" ? "line-through" : "none",
            }}
          >
            {deadline.label}
          </span>
        ) : (
          <span />
        )}
        {festival.application_url && (
          <a
            href={festival.application_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-sm font-medium text-white px-3.5 py-1.5 rounded-lg transition-colors"
            style={{ background: "var(--accent)" }}
          >
            Postuler →
          </a>
        )}
      </div>
    </div>
  );
}
