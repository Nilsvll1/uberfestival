import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { TestimonialsSection } from "@/components/ui/testimonials-section";
import { PricingSection } from "@/app/components/PricingSection";
import { CredibilitySection } from "@/app/components/CredibilitySection";
import { supabaseAdmin } from "../lib/supabase-admin";

export const metadata: Metadata = {
  title: "UberFestival — Festival opportunities for music professionals",
  description:
    "Discover open calls from festivals worldwide. Save opportunities, track deadlines, and grow your music career.",
};

const getStats = unstable_cache(
  async () => {
    const APPLY_STATUSES = ["verified_application", "filmfreeway", "festhome", "email_submission", "contact_form"];
    const [applyRes, countryRes] = await Promise.all([
      supabaseAdmin.from("festivals").select("id", { count: "exact", head: true })
        .in("application_status", APPLY_STATUSES).eq("is_archived", false),
      supabaseAdmin.from("festivals").select("country").eq("is_archived", false).not("country", "is", null),
    ]);
    const applyCount = applyRes.count ?? 0;
    const countries = new Set((countryRes.data ?? []).map((r: { country: string }) => r.country)).size;
    return { applyCount, countries };
  },
  ["landing-stats"],
  { tags: ["festivals"], revalidate: 3600 }
);

export default async function LandingPage() {
  const { applyCount, countries } = await getStats();
  const applyLabel = applyCount >= 300 ? "300+" : applyCount >= 200 ? "200+" : `${applyCount}+`;
  const countryLabel = countries >= 60 ? "60+" : countries >= 40 ? "40+" : `${countries}+`;
  return (
    <main
      className="text-white"
      style={{ background: "#030812" }}
    >
      {/* ── Hero scroll ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* ── Hero atmospheric lighting ── */}
        {/* Crown — fills the space above the headline with indigo warmth */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: [
              "radial-gradient(ellipse 100% 52% at 50% -2%, rgba(99,102,241,0.34) 0%, transparent 62%)",
              "radial-gradient(ellipse 60% 38% at 12% 35%, rgba(59,130,246,0.12) 0%, transparent 68%)",
              "radial-gradient(ellipse 60% 34% at 88% 26%, rgba(139,92,246,0.11) 0%, transparent 66%)",
            ].join(", "),
          }}
        />
        {/* Floor — device screen illuminating the space below it */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 28% at 50% 88%, rgba(67,56,202,0.22) 0%, rgba(37,99,235,0.06) 55%, transparent 75%)",
          }}
        />

        <ContainerScroll
          titleComponent={
            <div className="px-4 text-center">
              {/* Live badge */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-8"
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#34D399" }}
                />
                <span
                  className="font-medium uppercase"
                  style={{
                    fontSize: "10.5px",
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: "0.10em",
                  }}
                >
                  Live — {applyLabel} open calls worldwide
                </span>
              </div>

              {/* Logo lockup */}
              <div className="flex items-center justify-center gap-2.5 mb-6">
                <Image
                  src="/logo-icon.png"
                  alt=""
                  width={36}
                  height={36}
                  className="rounded-xl"
                  priority
                />
                <span
                  className="font-semibold tracking-tight"
                  style={{ fontSize: "18px", color: "#fff" }}
                >
                  UberFestival
                </span>
              </div>

              {/* Headline */}
              <h1
                className="font-extrabold leading-[1.04]"
                style={{
                  fontSize: "clamp(2.4rem, 7vw, 5.5rem)",
                  letterSpacing: "-0.04em",
                  color: "#fff",
                  marginBottom: "1.25rem",
                }}
              >
                Your next career
                <br />
                <span style={{ color: "#818CF8" }}>opportunity starts here.</span>
              </h1>

              {/* Subtitle */}
              <p
                className="max-w-xl mx-auto leading-relaxed"
                style={{
                  fontSize: "clamp(0.95rem, 2vw, 1.1rem)",
                  color: "rgba(255,255,255,0.42)",
                  marginBottom: "2rem",
                }}
              >
                Discover open calls from festivals worldwide. Save
                opportunities, track deadlines, and grow your music career —
                all in one place.
              </p>

              {/* CTA buttons */}
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{
                    fontSize: "14px",
                    padding: "12px 24px",
                    background:
                      "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
                    color: "#fff",
                    boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
                  }}
                >
                  Explore opportunities
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 9.5l7-7M4 2.5h5.5V8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full font-medium transition-all hover:border-white/20 hover:text-white"
                  style={{
                    fontSize: "14px",
                    padding: "12px 24px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "rgba(255,255,255,0.60)",
                  }}
                >
                  Sign in free
                </Link>
              </div>
            </div>
          }
        >
          <Image
            src="/app-screenshot.png"
            alt="UberFestival — interactive festival map and open calls list"
            height={900}
            width={1600}
            className="w-full object-cover h-full object-top"
            style={{ filter: "brightness(1.05) contrast(1.07) saturate(1.10)" }}
            draggable={false}
            priority
          />
        </ContainerScroll>
      </section>

      {/* ── Credibility ──────────────────────────────────────────── */}
      <CredibilitySection />

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <PricingSection />

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <section
        className="max-w-3xl mx-auto px-6"
        style={{ paddingTop: "4rem", paddingBottom: "5rem" }}
      >
        <div
          className="grid grid-cols-3 gap-4 rounded-2xl p-6 md:p-8"
          style={{
            background: "#080D1C",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            { value: applyLabel, label: "Open calls" },
            { value: countryLabel, label: "Countries" },
            { value: "20+", label: "Music genres" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="text-center flex flex-col gap-1"
              style={{
                borderRight:
                  i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <span
                className="font-extrabold tracking-tight"
                style={{
                  fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
                  color: "#818CF8",
                }}
              >
                {stat.value}
              </span>
              <span
                className="font-medium"
                style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}
              >
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section
        className="max-w-5xl mx-auto px-6"
        style={{ paddingBottom: "6rem" }}
      >
        <div className="text-center mb-12">
          <p
            className="uppercase font-semibold tracking-widest mb-3"
            style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.25)" }}
          >
            Why UberFestival
          </p>
          <h2
            className="font-extrabold tracking-tight"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          >
            Everything you need to grow your career
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              ),
              title: "Discover open calls",
              description:
                "Browse hundreds of festival opportunities on an interactive world map. Filter by genre, country, and urgency.",
            },
            {
              icon: (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              ),
              title: "Save opportunities",
              description:
                "Bookmark the festivals you're interested in and access your personal shortlist anytime from your dashboard.",
            },
            {
              icon: (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
              ),
              title: "Track deadlines",
              description:
                "Never miss a submission date. Urgency alerts highlight closing-soon opportunities so you can act fast.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: "#080D1C",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: "rgba(99,102,241,0.12)",
                  color: "#818CF8",
                }}
              >
                {feature.icon}
              </div>
              <div>
                <h3
                  className="font-semibold tracking-tight mb-2"
                  style={{ fontSize: "15px", color: "#fff" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="leading-relaxed"
                  style={{ fontSize: "13.5px", color: "rgba(255,255,255,0.38)" }}
                >
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <TestimonialsSection />

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section
        className="max-w-2xl mx-auto px-6"
        style={{ paddingBottom: "8rem" }}
      >
        <div
          className="rounded-3xl text-center"
          style={{
            padding: "clamp(2.5rem, 6vw, 4rem) clamp(2rem, 5vw, 3rem)",
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(82,84,232,0.06) 100%)",
            border: "1px solid rgba(99,102,241,0.20)",
          }}
        >
          <h2
            className="font-extrabold tracking-tight mb-3"
            style={{
              fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
              color: "#fff",
              letterSpacing: "-0.03em",
            }}
          >
            Start discovering today.
          </h2>
          <p
            className="mb-8 leading-relaxed"
            style={{ fontSize: "14px", color: "rgba(255,255,255,0.38)" }}
          >
            Free to use. No credit card required.
          </p>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-full font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              fontSize: "14.5px",
              padding: "14px 32px",
              background:
                "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
              color: "#fff",
              boxShadow: "0 4px 28px rgba(99,102,241,0.50)",
            }}
          >
            Explore festivals
            <svg
              width="13"
              height="13"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 9.5l7-7M4 2.5h5.5V8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        className="max-w-5xl mx-auto px-6 pb-10 flex items-center justify-between flex-wrap gap-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "2rem" }}
      >
        <div className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="" width={22} height={22} className="rounded-md opacity-70" />
          <span
            className="font-medium"
            style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}
          >
            © 2025 UberFestival
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/explore"
            style={{ fontSize: "13px", color: "rgba(255,255,255,0.30)" }}
            className="hover:text-white/60 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/login"
            style={{ fontSize: "13px", color: "rgba(255,255,255,0.30)" }}
            className="hover:text-white/60 transition-colors"
          >
            Sign in
          </Link>
          <a
            href="mailto:submit@uberfestival.com"
            style={{ fontSize: "13px", color: "rgba(255,255,255,0.30)" }}
            className="hover:text-white/60 transition-colors"
          >
            Submit a festival
          </a>
        </div>
      </footer>
    </main>
  );
}
