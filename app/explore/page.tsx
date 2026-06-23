import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "../../lib/supabase-server";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage, getTranslations } from "../../lib/i18n";
import SearchableFestivals from "../components/SearchableFestivals";

export default async function Home() {
  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;
  const t = getTranslations(lang);

  const supabase = await createClient();

  // Fetch festivals and user in parallel.
  const [festivalsResult, { data: { user } }] = await Promise.all([
    supabase
      .from("festivals")
      .select(
        "id, festival_name, city, country, category, application_url, submission_deadline, latitude, longitude, website, hero_image_url, description"
      )
      // Exclude archived opportunities — soft-deleted by the weekly pipeline
      .neq("is_archived", true),
    supabase.auth.getUser(),
  ]);

  const { data, error } = festivalsResult;

  if (error) {
    return (
      <main className="max-w-screen-xl mx-auto px-6 py-10">
        <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
          {t.error.connection}
        </p>
        <pre
          className="mt-2 text-xs rounded-2xl p-4 border"
          style={{
            background: "#fff",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          {error.message}
        </pre>
      </main>
    );
  }

  // Fetch saved festival IDs and premium status for the logged-in user.
  let savedIds: number[] = [];
  let isPremium: boolean | null = null;
  if (user) {
    const [savedResult, profileResult] = await Promise.all([
      supabase.from("saved_festivals").select("festival_id").eq("user_id", user.id),
      supabase.from("profiles").select("is_premium").eq("id", user.id).single(),
    ]);
    savedIds = savedResult.data?.map((s: { festival_id: number }) => s.festival_id) ?? [];
    isPremium = profileResult.data?.is_premium ?? false;
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="flex-1 overflow-hidden">
      <Suspense>
        <SearchableFestivals
          festivals={data || []}
          userId={user?.id ?? null}
          savedIds={savedIds}
          today={today}
          isPremium={isPremium}
        />
      </Suspense>
    </main>
  );
}
