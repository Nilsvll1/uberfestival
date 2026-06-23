import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase-server";
import { cookies } from "next/headers";
import {
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  isValidLanguage,
} from "../../lib/i18n";
import FestivalCard from "../components/FestivalCard";
import { formatDeadline } from "../../lib/utils";
import type { Festival } from "../../lib/types";

export const metadata: Metadata = {
  title: "Dashboard | UberFestival",
};

type SavedRow = {
  saved_at: string;
  festivals: Festival;
};

type ViewRow = {
  viewed_at: string;
  festivals: Festival;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  // Fetch profile, saved festivals, and recent views in parallel.
  const [profileResult, savedResult, viewsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("saved_festivals")
      .select("saved_at, festivals(*)")
      .eq("user_id", user.id)
      .order("saved_at", { ascending: false }),
    supabase
      .from("festival_views")
      .select("viewed_at, festivals(*)")
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(6),
  ]);

  const profile = profileResult.data;
  const savedRows = (savedResult.data ?? []) as unknown as SavedRow[];
  const viewRows = (viewsResult.data ?? []) as unknown as ViewRow[];

  const savedFestivals = savedRows.map((r) => r.festivals).filter(Boolean);
  const recentFestivals = viewRows.map((r) => r.festivals).filter(Boolean);

  // Compute saved IDs for SaveButton state.
  const savedIds = savedFestivals.map((f) => f.id);

  // Upcoming deadlines from saved (next 30 days, not expired).
  const today = new Date().toISOString().slice(0, 10);
  const urgentSaved = savedFestivals
    .filter((f) => {
      if (!f.submission_deadline) return false;
      const dl = f.submission_deadline.slice(0, 10);
      return dl >= today;
    })
    .sort((a, b) => {
      const da = a.submission_deadline?.slice(0, 10) ?? "9999";
      const db = b.submission_deadline?.slice(0, 10) ?? "9999";
      return da.localeCompare(db);
    })
    .slice(0, 5);

  const displayName = profile?.artist_name || user.email?.split("@")[0] || "Artist";
  const hour = new Date().getHours();
  const greeting =
    lang === "fr"
      ? hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir"
      : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Profile completion (0–100).
  const profileFields = [
    profile?.artist_name,
    profile?.country,
    profile?.primary_genre,
    profile?.instagram_url,
    profile?.spotify_url,
    profile?.website_url,
  ];
  const completion = Math.round(
    (profileFields.filter(Boolean).length / profileFields.length) * 100
  );

  return (
    <main className="max-w-[960px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

      {/* ── Hero row ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
        <div>
          <p
            className="uppercase font-semibold tracking-[0.1em] mb-2"
            style={{ fontSize: "10px", color: "var(--text-muted)" }}
          >
            {lang === "fr" ? "Tableau de bord" : "Dashboard"}
          </p>
          <h1
            className="font-extrabold leading-tight"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
          >
            {greeting},{" "}
            <span style={{ color: "var(--accent)" }}>{displayName}.</span>
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: 6 }}>
            {lang === "fr"
              ? `${savedFestivals.length} opportunité${savedFestivals.length !== 1 ? "s" : ""} sauvegardée${savedFestivals.length !== 1 ? "s" : ""}`
              : `${savedFestivals.length} saved opportunit${savedFestivals.length !== 1 ? "ies" : "y"}`}
            {urgentSaved.length > 0 && (
              <span style={{ color: "#DC2626", fontWeight: 600 }}>
                {" "}· {urgentSaved.length} {lang === "fr" ? "deadline proche" : "deadline approaching"}
              </span>
            )}
          </p>
        </div>

        {/* Profile completion nudge */}
        {completion < 100 && (
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 rounded-[14px] border px-4 py-3 transition-all hover:shadow-md"
            style={{
              background: "#fff",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-sm)",
              textDecoration: "none",
              minWidth: 220,
            }}
          >
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "2px solid rgba(99,102,241,0.2)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="5" r="2.5"/>
                <path d="M2 12c0-2.21 2.239-4 5-4s5 1.79 5 4"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                {lang === "fr" ? "Compléter le profil" : "Complete profile"}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className="relative rounded-full overflow-hidden"
                  style={{ width: 80, height: 4, background: "rgba(0,0,0,0.08)" }}
                >
                  <div
                    className="absolute left-0 top-0 h-full rounded-full"
                    style={{
                      width: `${completion}%`,
                      background: "linear-gradient(90deg, #818CF8, #6366F1)",
                    }}
                  />
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{completion}%</span>
              </div>
            </div>
          </Link>
        )}
      </div>

      {/* ── Upcoming deadlines ─────────────────────────────── */}
      {urgentSaved.length > 0 && (
        <section className="mb-10">
          <SectionHeader
            label={lang === "fr" ? "Deadlines à venir" : "Upcoming deadlines"}
            icon={
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <circle cx="7" cy="7" r="5.5"/>
                <path d="M7 4v3.5l2 2"/>
              </svg>
            }
            hot
          />
          <div className="flex flex-col gap-2 mt-4">
            {urgentSaved.map((festival) => {
              const dl = formatDeadline(festival.submission_deadline, lang);
              const isUrgent = dl?.status === "urgent";
              return (
                <Link
                  key={festival.id}
                  href={`/festival/${festival.id}`}
                  className="flex items-center gap-3 rounded-[13px] border px-4 py-3 transition-all hover:shadow-md"
                  style={{
                    background: "#fff",
                    borderColor: isUrgent ? "rgba(220,38,38,0.25)" : "var(--border)",
                    boxShadow: isUrgent ? "inset 3px 0 0 #DC2626, var(--shadow-sm)" : "var(--shadow-sm)",
                    textDecoration: "none",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold truncate"
                      style={{ fontSize: "13.5px", color: "var(--text-primary)", letterSpacing: "-0.02em" }}
                    >
                      {festival.festival_name}
                    </p>
                    <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: 1 }}>
                      {[festival.city, festival.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-semibold tabular-nums"
                    style={{
                      fontSize: "12px",
                      color: isUrgent ? "#DC2626" : "var(--text-secondary)",
                    }}
                  >
                    {dl?.label}
                  </span>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M4.5 2.5l3 3.5-3 3.5"/>
                  </svg>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Saved festivals ────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <SectionHeader
            label={lang === "fr" ? `Sauvegardés (${savedFestivals.length})` : `Saved (${savedFestivals.length})`}
            icon={
              <svg width="13" height="13" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h10v12.5L7 10.5 2 14.5V2z"/>
              </svg>
            }
          />
          <Link
            href="/explore"
            style={{ fontSize: "13px", color: "var(--accent)", textDecoration: "none" }}
            className="hover:opacity-70 transition-opacity"
          >
            {lang === "fr" ? "Explorer →" : "Explore →"}
          </Link>
        </div>

        {savedFestivals.length === 0 ? (
          <div
            className="rounded-[18px] border flex flex-col items-center justify-center gap-4 py-16 text-center"
            style={{ borderColor: "var(--border)", background: "#fff", borderStyle: "dashed" }}
          >
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <svg width="16" height="16" viewBox="0 0 14 16" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h10v12.5L7 10.5 2 14.5V2z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                {lang === "fr" ? "Aucune opportunité sauvegardée" : "No saved opportunities yet"}
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 4 }}>
                {lang === "fr" ? "Explore la carte et sauvegarde des festivals." : "Browse the map and save festivals you're interested in."}
              </p>
            </div>
            <Link href="/explore" className="btn-cta inline-flex items-center gap-2 font-semibold rounded-[11px] px-4 py-2.5" style={{ fontSize: "13px" }}>
              {lang === "fr" ? "Explorer les festivals" : "Explore festivals"}
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedFestivals.map((festival, i) => (
              <FestivalCard
                key={festival.id}
                festival={festival}
                index={i}
                lang={lang}
                userId={user.id}
                initialSaved={savedIds.includes(festival.id)}
                isPremium={profile?.is_premium ?? false}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recently viewed ────────────────────────────────── */}
      {recentFestivals.length > 0 && (
        <section>
          <SectionHeader
            label={lang === "fr" ? "Vus récemment" : "Recently viewed"}
            icon={
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="5.5"/>
                <path d="M7 4v3l2 1.5"/>
              </svg>
            }
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {recentFestivals.map((festival, i) => (
              <FestivalCard
                key={festival.id}
                festival={festival}
                index={i}
                lang={lang}
                userId={user.id}
                initialSaved={savedIds.includes(festival.id)}
                isPremium={profile?.is_premium ?? false}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function SectionHeader({
  label,
  icon,
  hot = false,
}: {
  label: string;
  icon: React.ReactNode;
  hot?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: hot ? "#DC2626" : "var(--text-muted)" }}>{icon}</span>
      <span
        className="font-semibold"
        style={{ fontSize: "15px", letterSpacing: "-0.02em", color: hot ? "#DC2626" : "var(--text-primary)" }}
      >
        {label}
      </span>
    </div>
  );
}
