import Link from "next/link";
import type { Festival } from "../../lib/types";
import { formatDeadline, genreColor } from "../../lib/utils";
import { getFestivalImage } from "../../lib/festivalImage";
import type { Language } from "../../lib/i18n";
import { getTranslations } from "../../lib/i18n";
import SaveButton from "./SaveButton";

export default function FestivalCard({
  festival,
  index = 0,
  lang = "en",
  isActive = false,
  isDimmed = false,
}: {
  festival: Festival;
  index?: number;
  lang?: Language;
  isActive?: boolean;
  isDimmed?: boolean;
}) {
  const t        = getTranslations(lang);
  const deadline = formatDeadline(festival.submission_deadline, lang);
  const color    = festival.category ? genreColor(festival.category) : null;
  const image    = getFestivalImage(festival.category, festival.id);
  const isUrgent = deadline?.status === "urgent";
  const isSoon   = deadline?.status === "soon";

  const deadlineColor =
    isUrgent ? "#DC2626" :
    isSoon   ? "#CA8A04" :
    deadline?.status === "expired" ? "var(--text-muted)" :
    "#16A34A";

  const urgentShadow = isUrgent
    ? "inset 3px 0 0 #DC2626"
    : isSoon
    ? "inset 3px 0 0 #CA8A04"
    : null;

  const activeShadow = isActive
    ? `0 0 0 2px var(--accent), 0 4px 16px rgba(99,102,241,0.18)`
    : null;

  const baseShadow = "var(--shadow-sm)";
  const boxShadow = [urgentShadow, activeShadow, baseShadow]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="festival-card animate-fadeup group relative rounded-[18px] border overflow-hidden flex flex-col bg-white"
      style={{
        boxShadow,
        borderColor: isActive ? "var(--accent)" : undefined,
        opacity: isDimmed ? 0.55 : 1,
        transform: isDimmed ? "scale(0.985)" : undefined,
        transition: "opacity 220ms ease, transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
        willChange: "transform",
      }}
    >
      {/* ── Hero image ──────────────────────────────────────── */}
      <Link
        href={`/festival/${festival.id}`}
        className="block relative overflow-hidden shrink-0"
        style={{ height: 200 }}
      >
        {/* Gradient fallback */}
        <div className="absolute inset-0" style={{ background: image.gradient }} />

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover card-img"
          loading="lazy"
        />

        {/* Cinematic overlay — heavier at bottom for legibility */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              to bottom,
              rgba(0,0,0,0.04) 0%,
              rgba(0,0,0,0.10) 50%,
              rgba(0,0,0,${image.overlayStrength * 0.9}) 100%
            )`,
          }}
        />

        {/* Genre badge — bottom left */}
        {color && festival.category && (
          <div className="absolute bottom-3 left-3 z-10">
            <span
              className="inline-flex items-center text-[10px] font-semibold px-2 py-[3px] rounded-full"
              style={{
                background: "rgba(255,255,255,0.92)",
                color: color.text,
                backdropFilter: "blur(8px)",
                letterSpacing: "0.04em",
              }}
            >
              {festival.category}
            </span>
          </div>
        )}

        {/* Bookmark */}
        <SaveButton label={t.card.save} />
      </Link>

      {/* ── Card body ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 p-4">
        {/* Name + location */}
        <div>
          <Link
            href={`/festival/${festival.id}`}
            className="font-bold leading-snug block hover:text-[var(--accent)] transition-colors"
            style={{ fontSize: "15px", letterSpacing: "-0.025em", color: "var(--text-primary)" }}
          >
            {festival.festival_name}
          </Link>
          {(festival.city || festival.country) && (
            <p className="flex items-center gap-1 text-[11.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              <svg width="9" height="9" viewBox="0 0 10 12" fill="none" className="shrink-0 opacity-60">
                <path d="M5 0C2.79 0 1 1.79 1 4c0 3.5 4 8 4 8s4-4.5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor"/>
              </svg>
              {[festival.city, festival.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-2 pt-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {deadline ? (
            <span
              className={`text-[11px] font-medium tabular-nums flex items-center gap-1.5`}
              style={{
                color: deadlineColor,
                textDecoration: deadline.status === "expired" ? "line-through" : "none",
              }}
            >
              {isUrgent && <span className="urgency-dot shrink-0" style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#DC2626" }} />}
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
              className="btn-cta shrink-0 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px]"
            >
              {t.card.apply}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
