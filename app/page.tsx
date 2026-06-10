import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "../lib/supabase-server";
import { DEFAULT_LANGUAGE, LANG_COOKIE, isValidLanguage, getTranslations } from "../lib/i18n";
import SearchableFestivals from "./components/SearchableFestivals";

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
        "id, festival_name, city, country, category, application_url, submission_deadline, latitude, longitude"
      ),
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

  // Fetch saved festival IDs for the logged-in user.
  let savedIds: number[] = [];
  if (user) {
    const { data: saved } = await supabase
      .from("saved_festivals")
      .select("festival_id")
      .eq("user_id", user.id);
    savedIds = saved?.map((s: { festival_id: number }) => s.festival_id) ?? [];
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
        />
      </Suspense>
    </main>
  );
}
