import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase-server";
import FestivalCard from "../../components/FestivalCard";
import { getPersonalizedFeed } from "../../../lib/recommendations";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage } from "../../../lib/i18n";
import type { Festival } from "../../../lib/types";
import type { RecommendationReason } from "../../../lib/recommendations";

export const metadata: Metadata = {
  title: "Recommended for you | UberFestival",
};

const REASON_COLORS: Record<RecommendationReason["type"], { bg: string; color: string }> = {
  genre:         { bg: "rgba(99,102,241,0.10)",  color: "#4F46E5" },
  country:       { bg: "rgba(16,185,129,0.10)",  color: "#059669" },
  popular:       { bg: "rgba(245,158,11,0.10)",  color: "#D97706" },
  applied:       { bg: "rgba(239,68,68,0.10)",   color: "#DC2626" },
  verified:      { bg: "rgba(34,197,94,0.10)",   color: "#16A34A" },
  deadline:      { bg: "rgba(239,68,68,0.10)",   color: "#DC2626" },
  collaborative: { bg: "rgba(139,92,246,0.10)",  color: "#7C3AED" },
};

export default async function RecommendationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, primary_genre, country")
    .eq("id", user.id)
    .single();

  if (profile?.is_premium !== true) {
    redirect("/#pricing");
  }

  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const [recommendations, savedResult] = await Promise.all([
    getPersonalizedFeed(
      user.id,
      profile?.primary_genre ?? null,
      profile?.country ?? null,
    ),
    supabase.from("saved_festivals").select("festival_id").eq("user_id", user.id),
  ]);

  const savedIds = (savedResult.data ?? []).map((r) => r.festival_id);

  return (
    <main className="max-w-[960px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard"
              className="transition-opacity hover:opacity-60"
              style={{ fontSize: "13px", color: "var(--text-muted)", textDecoration: "none" }}
            >
              Dashboard
            </Link>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round">
              <path d="M3.5 2l3 3-3 3"/>
            </svg>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>For you</span>
          </div>
          <h1
            className="font-extrabold leading-tight"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
          >
            Recommended{" "}
            <span style={{ color: "var(--accent)" }}>for you</span>
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: 6 }}>
            {recommendations.length} personalised{" "}
            {recommendations.length === 1 ? "opportunity" : "opportunities"}
            {profile?.primary_genre && (
              <> · {profile.primary_genre}</>
            )}
            {profile?.country && (
              <> · {profile.country}</>
            )}
          </p>
        </div>

        {/* Premium badge */}
        <span
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold"
          style={{
            fontSize: "11.5px",
            background: "linear-gradient(135deg, #6366F1, #818CF8)",
            color: "#fff",
            boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 1l2.5 5 5.5.8-4 3.9.9 5.5L12 14l-4.9 2.6.9-5.5L4 7.8 9.5 7z"/>
          </svg>
          Premium
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div
          className="rounded-[18px] border flex flex-col items-center justify-center gap-4 py-16 text-center"
          style={{ borderColor: "var(--border)", background: "#fff", borderStyle: "dashed" }}
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
              No recommendations yet
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 4 }}>
              Complete your profile with your genre and country to get personalised suggestions.
            </p>
          </div>
          <Link
            href="/dashboard/profile"
            className="btn-cta inline-flex items-center gap-2 font-semibold rounded-[11px] px-4 py-2.5"
            style={{ fontSize: "13px" }}
          >
            Complete profile
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((f, i) => (
            <div key={f.id} className="flex flex-col gap-2">
              <FestivalCard
                festival={f as unknown as Festival}
                index={i}
                lang={lang}
                userId={user.id}
                initialSaved={savedIds.includes(f.id)}
                isPremium={true}
              />
              {f.reasons.length > 0 && (
                <div className="flex gap-1.5 flex-wrap px-1">
                  {f.reasons.slice(0, 3).map((r) => {
                    const style = REASON_COLORS[r.type] ?? { bg: "rgba(0,0,0,0.06)", color: "var(--text-muted)" };
                    return (
                      <span
                        key={r.type}
                        className="font-medium"
                        style={{
                          fontSize: "10.5px",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: style.bg,
                          color: style.color,
                          letterSpacing: "0.01em",
                        }}
                      >
                        {r.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
