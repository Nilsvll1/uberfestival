"use client";

import { memo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Festival } from "../../lib/types";
import { formatDeadline, genreColor, getOpportunityScore, getUrgencyGroup } from "../../lib/utils";
import { getFestivalImage } from "../../lib/festivalImage";
import type { Language } from "../../lib/i18n";
import { getTranslations } from "../../lib/i18n";
import SaveButton from "./SaveButton";
import FestivalImage from "./FestivalImage";

// Premium layered shadow — Linear/Stripe style
const SHADOW_BASE =
  "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)";
const SHADOW_HOVER =
  "0 16px 48px -8px rgba(0,0,0,0.16), 0 6px 20px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)";

const FestivalCard = memo(function FestivalCard({
  festival,
  index = 0,
  lang = "en",
  isActive = false,
  isDimmed = false,
  userId = null,
  initialSaved = false,
  isPremium = null,
}: {
  festival: Festival;
  index?: number;
  lang?: Language;
  isActive?: boolean;
  isDimmed?: boolean;
  userId?: string | null;
  initialSaved?: boolean;
  isPremium?: boolean | null;
}) {
  const t        = getTranslations(lang);
  const deadline = formatDeadline(festival.submission_deadline, lang);
  const color    = festival.category ? genreColor(festival.category) : null;
  const image    = getFestivalImage(festival.category, festival.id, festival.hero_image_url);
  const isUrgent = deadline?.status === "urgent";
  const isSoon   = deadline?.status === "soon";
  const score    = getOpportunityScore(festival);
  const urgGroup = getUrgencyGroup(festival.submission_deadline);

  const deadlineColor =
    isUrgent ? "#DC2626" :
    isSoon   ? "#CA8A04" :
    deadline?.status === "expired" ? "var(--text-muted)" :
    "#16A34A";

  const urgentAccent = isUrgent
    ? "inset 3px 0 0 #DC2626"
    : isSoon
    ? "inset 3px 0 0 #CA8A04"
    : null;

  const activeShadow = isActive
    ? "0 0 0 2px var(--accent), 0 4px 16px rgba(99,102,241,0.18)"
    : null;

  const boxShadow = [urgentAccent, activeShadow, SHADOW_BASE].filter(Boolean).join(", ");
  const hoverShadow = [urgentAccent, SHADOW_HOVER].filter(Boolean).join(", ");

  return (
    <motion.div
      className="festival-card group relative rounded-[18px] border overflow-hidden flex flex-col bg-white"
      style={{
        boxShadow,
        borderColor: isActive ? "var(--accent)" : "var(--border)",
      }}
      animate={{
        opacity: isDimmed ? 0.55 : 1,
        scale: isDimmed ? 0.985 : 1,
      }}
      whileHover={{
        y: -4,
        scale: 1.02,
        boxShadow: hoverShadow,
        borderColor: "rgba(0,0,0,0.06)",
      }}
      transition={{
        type: "spring",
        stiffness: 320,
        damping: 26,
        opacity: { duration: 0.2, ease: "easeOut" },
      }}
    >
      {/* ── Hero image ──────────────────────────────────────── */}
      <Link
        href={`/festival/${festival.id}`}
        className="block relative overflow-hidden shrink-0"
        style={{ height: 200 }}
      >
        <FestivalImage
          image={image}
          category={festival.category}
          color={color}
          layoutId={`festival-img-${festival.id}`}
        />
        <SaveButton
          label={t.card.save}
          festivalId={festival.id}
          userId={userId}
          initialSaved={initialSaved}
        />

        {/* Opportunity score badge — top left */}
        {score.tier !== "limited" && (
          <div
            className="absolute top-2.5 left-2.5 z-10 tabular-nums"
            style={{
              background: score.bg,
              color: score.color,
              border: `1px solid ${score.color}33`,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              borderRadius: 7,
              padding: "2px 6px",
              fontSize: "10.5px",
              fontWeight: 700,
              letterSpacing: "0.01em",
              lineHeight: 1.4,
            }}
          >
            {score.score}
          </div>
        )}

        {/* Closing-soon urgency pill — bottom right (replaces when space allows) */}
        {urgGroup === "this-week" && deadline && deadline.status !== "expired" && (
          <div
            className="absolute bottom-3 right-3 z-10 flex items-center gap-1"
            style={{
              background: "rgba(220,38,38,0.88)",
              color: "#fff",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              borderRadius: 6,
              padding: "2px 7px",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.01em",
            }}
          >
            <span style={{ fontSize: 9 }}>●</span>
            {deadline.label}
          </div>
        )}
      </Link>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 p-4">
        <div>
          <Link
            href={`/festival/${festival.id}`}
            className="font-bold leading-snug block hover:text-[var(--accent)] transition-colors"
            style={{ fontSize: "15px", letterSpacing: "-0.025em", color: "var(--text-primary)" }}
          >
            {festival.festival_name}
          </Link>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {(festival.city || festival.country) && (
              <p className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                <svg width="9" height="9" viewBox="0 0 10 12" fill="none" className="shrink-0 opacity-60">
                  <path d="M5 0C2.79 0 1 1.79 1 4c0 3.5 4 8 4 8s4-4.5 4-8c0-2.21-1.79-4-4-4z" fill="currentColor" />
                </svg>
                {[festival.city, festival.country].filter(Boolean).join(", ")}
              </p>
            )}
            {color && festival.category && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: color.bg, color: color.text, letterSpacing: "0.01em" }}
              >
                {festival.category}
              </span>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-between gap-2 pt-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {deadline ? (
            <span
              className="text-[11px] font-medium tabular-nums flex items-center gap-1.5"
              style={{
                color: deadlineColor,
                textDecoration: deadline.status === "expired" ? "line-through" : "none",
              }}
            >
              {isUrgent && (
                <span
                  className="urgency-dot shrink-0"
                  style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#DC2626" }}
                />
              )}
              {deadline.label}
            </span>
          ) : (
            <span />
          )}

          {festival.application_url && isPremium === false ? (
            <a
              href="/#pricing"
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-[7px] inline-flex items-center gap-1"
              style={{ background: "rgba(99,102,241,0.08)", color: "#6366F1", border: "1px solid rgba(99,102,241,0.20)" }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1l2.5 5 5.5.8-4 3.9.9 5.5L12 14l-4.9 2.6.9-5.5L4 7.8 9.5 7z"/>
              </svg>
              Premium
            </a>
          ) : (festival.application_url || festival.website) ? (
            <a
              href={festival.application_url ?? festival.website ?? ""}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-cta shrink-0 text-[11.5px] font-semibold px-2.5 py-1.5 rounded-[7px] inline-flex items-center gap-1"
            >
              {festival.application_url ? t.card.apply : t.card.visitWebsite}
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 8L8 2M4 2h4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
});

export default FestivalCard;
