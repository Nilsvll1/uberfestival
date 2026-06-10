import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import FestivalMapWrapper from "../../components/FestivalMapWrapper";
import FestivalCard from "../../components/FestivalCard";
import DetailHero from "../../components/DetailHero";
import ScrollReveal from "../../components/ScrollReveal";
import { formatDeadline, genreColor } from "../../../lib/utils";
import { getFestivalImage, getMood, getAtmosphericText } from "../../../lib/festivalImage";
import { getTranslations, isValidLanguage, DEFAULT_LANGUAGE, LANG_COOKIE } from "../../../lib/i18n";
import type { Festival } from "../../../lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabase
    .from("festivals")
    .select("festival_name, city, country, category")
    .eq("id", id)
    .single();

  if (!data) return { title: "Festival | UberFestival" };

  const location = [data.city, data.country].filter(Boolean).join(", ");
  const title = location
    ? `${data.festival_name} — ${location} | UberFestival`
    : `${data.festival_name} | UberFestival`;
  const description = [
    data.category ? `${data.category} festival` : "Music festival",
    location ? `in ${location}` : null,
    "— submit your application on UberFestival.",
  ].filter(Boolean).join(" ");

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function FestivalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Read language from cookie (same approach as layout.tsx)
  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;
  const t = getTranslations(lang);

  const { data: festival, error } = await supabase
    .from("festivals")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !festival) notFound();

  const { data: related } = await supabase
    .from("festivals")
    .select("id, festival_name, city, country, category, application_url, submission_deadline, latitude, longitude")
    .eq("category", festival.category)
    .neq("id", Number(id))
    .limit(3);

  const deadline  = formatDeadline(festival.submission_deadline, lang);
  const color     = festival.category ? genreColor(festival.category) : null;
  const image     = getFestivalImage(festival.category, festival.id);
  const mood      = getMood(image, lang);
  const atmText   = getAtmosphericText(festival.category, festival.city, festival.country, lang);

  const dlColor =
    deadline?.status === "urgent"  ? "#ef4444"              :
    deadline?.status === "soon"    ? "#f59e0b"              :
    deadline?.status === "expired" ? "rgba(255,255,255,0.4)":
                                      "#4ade80";

  const dlColorContent =
    deadline?.status === "urgent"  ? "#DC2626"              :
    deadline?.status === "soon"    ? "#CA8A04"              :
    deadline?.status === "expired" ? "var(--text-muted)"   :
                                      "#16A34A";

  return (
    <main>

      {/* ╔════════════════════════════════════════════════════╗
          ║  HERO — parallax + shared transition with card     ║
          ╚════════════════════════════════════════════════════╝ */}
      <DetailHero
        imageUrl={image.url.replace("w=900", "w=1600").replace("q=75", "q=80")}
        gradient={image.gradient}
        festivalId={festival.id}
      >
        {/* Back button — frosted glass pill */}
        <Link
          href="/"
          className="hero-back-btn absolute top-5 left-5 lg:top-7 lg:left-8 z-10"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t.festival.back}
        </Link>

        {/* Hero content — anchored to bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 px-5 pb-8 lg:px-12 lg:pb-10"
          style={{ maxWidth: 900, margin: "0 auto" }}
        >
          {/* Genre + location row */}
          <div className="flex items-center gap-2.5 mb-4 flex-wrap">
            {color && festival.category && (
              <span
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.14)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.22)",
                  backdropFilter: "blur(8px)",
                  letterSpacing: "0.04em",
                }}
              >
                {festival.category}
              </span>
            )}
            {(festival.city || festival.country) && (
              <span
                className="flex items-center gap-1"
                style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px" }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M6 1C4.34 1 3 2.34 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.66-1.34-3-3-3z"/>
                  <circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none"/>
                </svg>
                {[festival.city, festival.country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>

          {/* Festival name */}
          <h1
            className="font-bold leading-[1.05]"
            style={{
              fontSize: "clamp(2rem, 5.5vw, 3.8rem)",
              letterSpacing: "-0.035em",
              color: "#fff",
            }}
          >
            {festival.festival_name}
          </h1>

          {/* Deadline + CTA */}
          <div className="flex items-center gap-4 mt-6 flex-wrap">
            {festival.application_url && (
              <a
                href={festival.application_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hero-apply-btn"
              >
                {t.festival.apply}
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 9.5l7-7M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            )}
            {deadline && (
              <span
                className="text-[12.5px] font-medium"
                style={{
                  color: deadline.status === "expired" ? "rgba(255,255,255,0.40)" : "rgba(255,255,255,0.75)",
                  textDecoration: deadline.status === "expired" ? "line-through" : "none",
                }}
              >
                {deadline.label}
              </span>
            )}
          </div>
        </div>
      </DetailHero>

      {/* ╔════════════════════════════════════════════════════╗
          ║  PAGE CONTENT                                       ║
          ╚════════════════════════════════════════════════════╝ */}
      <div className="max-w-[900px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

        {/* ── Atmosphere ────────────────────────────────────── */}
        <ScrollReveal delay={0.05}>
        <section className="mb-12 lg:mb-16">
          <p
            className="uppercase font-semibold tracking-[0.1em] mb-4"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            {t.festival.experience}
          </p>
          <p
            className="font-light leading-snug mb-5"
            style={{
              fontSize: "clamp(1.25rem, 3vw, 1.6rem)",
              letterSpacing: "-0.02em",
              color: "var(--text-primary)",
            }}
          >
            {mood}
          </p>
          <p
            className="leading-relaxed"
            style={{
              fontSize: "15px",
              color: "var(--text-secondary)",
              maxWidth: "58ch",
            }}
          >
            {atmText}
          </p>
        </section>
        </ScrollReveal>

        {/* ── Info + Map grid ────────────────────────────────── */}
        <ScrollReveal delay={0.1}>
        <div className="grid lg:grid-cols-2 gap-6 mb-12 lg:mb-16">

          {/* Info card */}
          <div
            className="rounded-[18px] border p-6 flex flex-col gap-5"
            style={{
              background: "#fff",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <p
              className="uppercase font-semibold tracking-[0.1em]"
              style={{ fontSize: "10px", color: "var(--text-muted)" }}
            >
              {t.festival.information}
            </p>

            <div className="flex flex-col gap-4">
              {festival.city && (
                <InfoRow
                  icon={<IconPin />}
                  label={t.festival.location}
                  value={[festival.city, festival.country].filter(Boolean).join(", ")}
                />
              )}
              {festival.category && color && (
                <InfoRow
                  icon={<IconMusic />}
                  label={t.festival.genre}
                  value={festival.category}
                  badge={color}
                />
              )}
              {deadline && (
                <InfoRow
                  icon={<IconCalendar />}
                  label={t.festival.deadline}
                  value={deadline.label}
                  valueColor={dlColorContent}
                />
              )}
            </div>

            {festival.description && (
              <>
                <div style={{ borderTop: "1px solid var(--border)" }} />
                <p
                  className="leading-relaxed"
                  style={{ fontSize: "13.5px", color: "var(--text-secondary)" }}
                >
                  {festival.description}
                </p>
              </>
            )}

            {/* CTA */}
            <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              {festival.application_url ? (
                <a
                  href={festival.application_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-cta flex items-center justify-center gap-2 w-full font-semibold py-3 rounded-[11px]"
                  style={{ fontSize: "14px" }}
                >
                  {t.festival.apply}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 9.5l7-7M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              ) : (
                <p
                  className="text-center text-sm"
                  style={{ color: "var(--text-muted)", fontSize: "13px" }}
                >
                  {t.festival.noApply}
                </p>
              )}
            </div>
          </div>

          {/* Map */}
          {festival.latitude && festival.longitude ? (
            <div
              className="rounded-[18px] overflow-hidden"
              style={{
                height: 340,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.06), 0 6px 28px rgba(0,0,0,0.07)",
              }}
            >
              <FestivalMapWrapper
                festivals={[festival as Festival]}
                className="h-full"
                center={[festival.latitude, festival.longitude]}
                zoom={11}
                scrollWheelZoom={false}
              />
            </div>
          ) : (
            <div
              className="rounded-[18px] border flex items-center justify-center"
              style={{ height: 340, borderColor: "var(--border)", background: "#fff" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                {t.festival.noLocation}
              </p>
            </div>
          )}
        </div>
        </ScrollReveal>

        {/* ── Related ────────────────────────────────────────── */}
        <ScrollReveal delay={0.05}>
        {related && related.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p
                  className="uppercase font-semibold tracking-[0.1em] mb-1"
                  style={{ fontSize: "10px", color: "var(--text-muted)" }}
                >
                  {t.festival.discover}
                </p>
                <h2
                  className="font-semibold"
                  style={{ fontSize: "18px", letterSpacing: "-0.02em", color: "var(--text-primary)" }}
                >
                  {t.festival.similar}
                </h2>
              </div>
              <Link
                href="/"
                className="transition-opacity hover:opacity-60"
                style={{ fontSize: "13px", color: "var(--accent)" }}
              >
                {t.festival.viewAll}
              </Link>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(related as Festival[]).map((f, i) => (
                <li key={f.id}>
                  <FestivalCard festival={f} index={i} lang={lang} />
                </li>
              ))}
            </ul>
          </section>
        )}
        </ScrollReveal>
      </div>
    </main>
  );
}

/* ── Inline icons ────────────────────────────────────────────── */
function IconPin() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M6 1C4.34 1 3 2.34 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.66-1.34-3-3-3z"/>
      <circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none"/>
    </svg>
  );
}
function IconMusic() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M5 9.5V3l6-1.5v6"/>
      <circle cx="4" cy="9.5" r="1.3"/>
      <circle cx="10" cy="7.5" r="1.3"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="1.5" y="2.5" width="10" height="9" rx="2"/>
      <path d="M4 1.5v2M9 1.5v2M1.5 5.5h10"/>
    </svg>
  );
}

/* ── InfoRow ─────────────────────────────────────────────────── */
function InfoRow({
  icon,
  label,
  value,
  valueColor = "var(--text-primary)",
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
  badge?: { bg: string; text: string };
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 w-5 h-5 flex items-center justify-center"
        style={{ color: "var(--text-muted)" }}
      >
        {icon}
      </span>
      <span
        className="shrink-0 w-[72px]"
        style={{ fontSize: "12px", color: "var(--text-muted)" }}
      >
        {label}
      </span>
      {badge ? (
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: badge.bg, color: badge.text }}
        >
          {value}
        </span>
      ) : (
        <span className="font-medium" style={{ fontSize: "13.5px", color: valueColor }}>
          {value}
        </span>
      )}
    </div>
  );
}
