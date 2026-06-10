import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase-server";
import ProfileForm from "../../components/ProfileForm";
import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage } from "../../../lib/i18n";

export const metadata: Metadata = {
  title: "Profile | UberFestival",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <main className="max-w-[680px] mx-auto px-5 lg:px-8 py-10 lg:py-14">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 mb-8 transition-opacity hover:opacity-60"
        style={{ fontSize: "13px", color: "var(--text-secondary)", textDecoration: "none" }}
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11L5 7l4-4"/>
        </svg>
        {lang === "fr" ? "Tableau de bord" : "Dashboard"}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p
          className="uppercase font-semibold tracking-[0.1em] mb-2"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}
        >
          {lang === "fr" ? "Paramètres" : "Settings"}
        </p>
        <h1
          className="font-extrabold"
          style={{ fontSize: "clamp(1.6rem, 4vw, 2.2rem)", letterSpacing: "-0.04em", color: "var(--text-primary)" }}
        >
          {lang === "fr" ? "Ton profil artiste" : "Your artist profile"}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: 6 }}>
          {lang === "fr"
            ? "Ces informations t'aident à trouver les meilleures opportunités."
            : "This information helps you find the most relevant opportunities."}
        </p>
      </div>

      <ProfileForm profile={profile ?? {}} />

      {/* Account info */}
      <div
        className="mt-8 rounded-[18px] border p-5 flex flex-col gap-3"
        style={{ background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <p
          className="uppercase font-semibold tracking-[0.1em]"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}
        >
          {lang === "fr" ? "Compte" : "Account"}
        </p>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold shrink-0"
            style={{
              fontSize: "11px",
              background: "linear-gradient(145deg, #818CF8 0%, #6366F1 55%, #5254E8 100%)",
              color: "#fff",
            }}
          >
            {user.email?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--text-primary)" }}>
              {user.email}
            </p>
            <p style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
              {lang === "fr" ? "Membre depuis " : "Member since "}
              {new Date(user.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", {
                year: "numeric",
                month: "long",
              })}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
