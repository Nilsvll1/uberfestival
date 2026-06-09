import Link from "next/link";
import type { Festival } from "../../lib/types";
import { formatDeadline, genreColor } from "../../lib/utils";
import { getFestivalImage } from "../../lib/festivalImage";
import type { Language } from "../../lib/i18n";
import { getTranslations } from "../../lib/i18n";
import SaveButton from "./SaveButton";

const deadlineColor: Record<string, string> = {
  ok:      "#16A34A",
  soon:    "#CA8A04",
  urgent:  "#DC2626",
  expired: "var(--text-muted)",
};

export default function FestivalCard({
  festival,
  index = 0,
  lang = "en",
}: {
  festival: Festival;
  index?: number;
  lang?: Language;
}) {
  const t        = getTranslations(lang);
  const deadline = formatDeadline(festival.submission_deadline, lang);
  const color    = festival.category ? genreColor(festival.category) : null;
  const image    = getFestivalImage(festival.category);
  const isUrgent = deadline?.status === "urgent";

  return (
    <div
      className="festival-card animate-fadeup group relative rounded-[18px] border overflow-hidden flex flex-col bg-white"
      style={{
        boxShadow: "var(--shadow-sm)",
        animationDelay: `${Math.min(index * 40, 400)}ms`,
      }}
    >
      {/* ── Hero image ──────────────────────────────────────── */}
      <Link
        href={`/festival/${festival.id}`}
        className="block relative overflow-hidden shrink-0"
        style={{ height: 160 }}
      >
        {/* Gradient background — instant, no network */}
        <div className="absolute inset-0" style={{ background: image.gradient }} />

        {/* Photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover card-img"
          loading="lazy"
        />

        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,${image.overlayStrength * 0.85}) 100%)`,
          }}
        />

        {/* Genre badge */}
        {color && festival.category && (
          <div className="absolute bottom-2.5 left-3 z-10">
            <span
              className="text-[10px] font-semibold px-2 py-[3px] rounded-full"
              style={{
                background: "rgba(255,255,255,0.93)",
                color: color.text,
                backdropFilter: "blur(8px)",
                letterSpacing: "0.03em",
              }}
            >
              {festival.category}
            </span>
          </div>
        )}

        {/* Bookmark — client component (has onClick) */}
        <SaveButton label={t.card.save} />
      </Link>

      {/* ── Card body ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 p-3.5">
        <div>
          <Link
            href={`/festival/${festival.id}`}
            className="font-semibold leading-snug block hover:text-[var(--accent)] transition-colors"
            style={{ fontSize: "13.5px", letterSpacing: "-0.015em", color: "var(--text-primary)" }}
          >
            {festival.festival_name}
          </Link>
          {(festival.city || festival.country) && (
            <p className="text-[11.5px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {[festival.city, festival.country].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2 pt-2.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {deadline ? (
            <span
              className={`text-[11px] font-medium tabular-nums flex items-center gap-1.5 ${isUrgent ? "urgency-label" : ""}`}
              style={{
                color: deadlineColor[deadline.status],
                textDecoration: deadline.status === "expired" ? "line-through" : "none",
              }}
            >
              {isUrgent && (
                <span
                  className="urgency-dot shrink-0"
                  style={{
                    display: "inline-block",
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#DC2626",
                  }}
                />
              )}
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
