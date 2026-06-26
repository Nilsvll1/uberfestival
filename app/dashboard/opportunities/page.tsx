import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase-server";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage } from "../../../lib/i18n";
import FestivalCard from "../../components/FestivalCard";
import type { Festival } from "../../../lib/types";

export const metadata: Metadata = {
  title: "Verified Opportunities | UberFestival Premium",
};

const APPLY_STATUSES = [
  "verified_application",
  "filmfreeway",
  "festhome",
  "email_submission",
  "contact_form",
] as const;

const CONTACT_STATUSES = ["contact_submission"] as const;

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileResult] = await Promise.all([
    supabase.from("profiles").select("is_premium, artist_name").eq("id", user.id).single(),
  ]);

  const isPremium: boolean | null = user ? (profileResult.data?.is_premium ?? false) : null;

  // Non-premium users see an upgrade prompt instead of redirect
  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const sp = await searchParams;
  const genreFilter = sp.genre ?? null;
  const countryFilter = sp.country ?? null;
  const sortBy = sp.sort ?? "deadline";

  let query = supabase
    .from("festivals")
    .select("id, festival_name, city, country, category, application_url, application_status, submission_deadline, latitude, longitude, hero_image_url, website, description")
    .in("application_status", [...APPLY_STATUSES])
    .eq("is_archived", false);

  if (genreFilter) query = query.eq("category", genreFilter);
  if (countryFilter) query = query.eq("country", countryFilter);

  if (sortBy === "deadline") {
    query = query.order("submission_deadline", { ascending: true, nullsFirst: false });
  } else if (sortBy === "country") {
    query = query.order("country", { ascending: true });
  } else if (sortBy === "genre") {
    query = query.order("category", { ascending: true });
  }

  let contactQuery = supabase
    .from("festivals")
    .select("id, festival_name, city, country, category, application_url, application_status, application_email, contact_form_url, submission_deadline, latitude, longitude, hero_image_url, website, description")
    .in("application_status", [...CONTACT_STATUSES])
    .eq("is_archived", false);
  if (genreFilter) contactQuery = contactQuery.eq("category", genreFilter);
  if (countryFilter) contactQuery = contactQuery.eq("country", countryFilter);
  if (sortBy === "deadline") contactQuery = contactQuery.order("submission_deadline", { ascending: true, nullsFirst: false });
  else if (sortBy === "country") contactQuery = contactQuery.order("country", { ascending: true });
  else if (sortBy === "genre") contactQuery = contactQuery.order("category", { ascending: true });

  const [festivalsResult, contactResult, savedResult, genresResult] = await Promise.all([
    query,
    contactQuery,
    supabase.from("saved_festivals").select("festival_id").eq("user_id", user.id),
    supabase.from("festivals").select("category")
      .in("application_status", [...APPLY_STATUSES, ...CONTACT_STATUSES])
      .eq("is_archived", false).not("category", "is", null),
  ]);

  const rawFestivals = festivalsResult.data ?? [];
  const rawContact = contactResult.data ?? [];
  const savedIds = (savedResult.data ?? []).map((s: { festival_id: number }) => s.festival_id);

  // Strip application_url before passing to client components
  const festivals = rawFestivals.map((f) => {
    const { application_url, ...rest } = f as Festival;
    return { ...rest, has_apply_url: !!application_url };
  });
  const contactFestivals = rawContact.map((f) => {
    const { application_url, ...rest } = f as Festival;
    return { ...rest, has_apply_url: !!application_url };
  });

  const genres = [...new Set(
    (genresResult.data ?? []).map((r: { category: string }) => r.category).filter(Boolean)
  )].sort();

  const updatedAt = new Date().toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

  return (
    <main className="max-w-[960px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href="/dashboard"
            className="text-[12px] hover:opacity-70 transition-opacity"
            style={{ color: "var(--text-muted)", textDecoration: "none" }}
          >
            Dashboard
          </Link>
          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>›</span>
          <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
            Verified Opportunities
          </span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1
              className="font-extrabold leading-tight"
              style={{ fontSize: "clamp(1.5rem, 4vw, 2.1rem)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
            >
              Verified opportunities
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: 5 }}>
              <strong>{festivals.length}</strong> verified apply paths
              {contactFestivals.length > 0 && (
                <> · <strong>{contactFestivals.length}</strong> contact opportunities</>
              )}
              <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>· Updated {updatedAt}</span>
            </p>
          </div>
          {isPremium !== true && (
            <a
              href="/#pricing"
              className="shrink-0 inline-flex items-center gap-2 font-semibold rounded-[11px] px-4 py-2.5 transition-opacity hover:opacity-90"
              style={{
                fontSize: "13px",
                background: "linear-gradient(135deg, #6366F1 0%, #5254E8 100%)",
                color: "#fff",
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(99,102,241,0.30)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1l2.5 5 5.5.8-4 3.9.9 5.5L12 14l-4.9 2.6.9-5.5L4 7.8 9.5 7z"/>
              </svg>
              Unlock Apply buttons — $27/yr
            </a>
          )}
        </div>
      </div>

      {/* ── Non-premium notice ────────────────────────────────── */}
      {isPremium !== true && (
        <div
          className="rounded-[14px] border p-4 mb-8 flex items-start gap-3"
          style={{
            background: "rgba(99,102,241,0.05)",
            borderColor: "rgba(99,102,241,0.2)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#6366F1" className="shrink-0 mt-0.5">
            <path d="M12 1l2.5 5 5.5.8-4 3.9.9 5.5L12 14l-4.9 2.6.9-5.5L4 7.8 9.5 7z"/>
          </svg>
          <div>
            <p className="font-semibold" style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>
              Premium unlocks the Apply button
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: 2 }}>
              You can browse all {festivals.length} verified opportunities. Premium members can submit applications directly.{" "}
              <a href="/#pricing" style={{ color: "#6366F1" }}>Get Premium for $27/year →</a>
            </p>
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span style={{ fontSize: "12px", color: "var(--text-muted)", marginRight: 4 }}>Sort:</span>
        {(["deadline", "genre", "country"] as const).map((s) => (
          <a
            key={s}
            href={`/dashboard/opportunities?${new URLSearchParams({
              ...(genreFilter ? { genre: genreFilter } : {}),
              ...(countryFilter ? { country: countryFilter } : {}),
              sort: s,
            }).toString()}`}
            className="capitalize rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-all"
            style={{
              background: sortBy === s ? "var(--accent)" : "rgba(0,0,0,0.05)",
              color: sortBy === s ? "#fff" : "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            {s === "deadline" ? "Deadline" : s === "genre" ? "Genre" : "Country"}
          </a>
        ))}

        {genres.length > 0 && (
          <>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: 8, marginRight: 4 }}>Genre:</span>
            <select
              className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium border"
              style={{
                background: genreFilter ? "var(--accent)" : "rgba(0,0,0,0.03)",
                color: genreFilter ? "#fff" : "var(--text-secondary)",
                borderColor: genreFilter ? "var(--accent)" : "var(--border)",
                cursor: "pointer",
              }}
              value={genreFilter ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                const params = new URLSearchParams({
                  ...(v ? { genre: v } : {}),
                  ...(countryFilter ? { country: countryFilter } : {}),
                  sort: sortBy,
                });
                window.location.href = `/dashboard/opportunities?${params.toString()}`;
              }}
            >
              <option value="">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </>
        )}

        {(genreFilter || countryFilter) && (
          <a
            href={`/dashboard/opportunities?sort=${sortBy}`}
            className="rounded-[8px] px-3 py-1.5 text-[12px] font-medium"
            style={{ color: "var(--text-muted)", textDecoration: "none" }}
          >
            Clear filters ×
          </a>
        )}
      </div>

      {/* ── Apply Now grid ────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: "#16A34A", display: "inline-block" }}
        />
        <span className="font-semibold text-[13px]" style={{ color: "var(--text-primary)" }}>
          Apply Now — {festivals.length} verified path{festivals.length !== 1 ? "s" : ""}
        </span>
      </div>
      {festivals.length === 0 ? (
        <div
          className="rounded-[18px] border flex flex-col items-center justify-center gap-4 py-12 text-center mb-10"
          style={{ borderColor: "var(--border)", background: "#fff", borderStyle: "dashed" }}
        >
          <p className="font-semibold" style={{ fontSize: "14px", color: "var(--text-primary)" }}>
            No verified opportunities match this filter
          </p>
          <a href="/dashboard/opportunities" className="text-[13px]" style={{ color: "var(--accent)", textDecoration: "none" }}>
            Clear filters →
          </a>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {festivals.map((festival, i) => (
            <FestivalCard
              key={festival.id}
              festival={festival}
              index={i}
              lang={lang}
              userId={user.id}
              initialSaved={savedIds.includes(festival.id)}
              isPremium={isPremium}
            />
          ))}
        </div>
      )}

      {/* ── Contact Submission section ─────────────────────────── */}
      {contactFestivals.length > 0 && (
        <>
          <div
            className="rounded-[14px] border p-4 mb-5"
            style={{ background: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.15)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: "#6366F1", display: "inline-block" }}
              />
              <span className="font-semibold text-[13px]" style={{ color: "var(--text-primary)" }}>
                Contact to Inquire — {contactFestivals.length} festival{contactFestivals.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", paddingLeft: 16 }}>
              No public portal found — but we found a contact path. Email or reach out to ask about performing.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contactFestivals.map((festival, i) => (
              <FestivalCard
                key={festival.id}
                festival={festival}
                index={i}
                lang={lang}
                userId={user.id}
                initialSaved={savedIds.includes(festival.id)}
                isPremium={isPremium}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
