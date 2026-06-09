import { Suspense } from "react";
import { supabase } from "../lib/supabase";
import SearchableFestivals from "./components/SearchableFestivals";

export default async function Home() {
  const { data, error } = await supabase
    .from("festivals")
    .select(
      "id, festival_name, city, country, category, application_url, submission_deadline, latitude, longitude"
    );

  if (error) {
    return (
      <main className="max-w-screen-xl mx-auto px-6 py-10">
        <p className="text-sm font-medium" style={{ color: "#DC2626" }}>
          Erreur de connexion à la base de données.
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

  return (
    <main className="max-w-screen-xl mx-auto px-6 py-6">
      <Suspense
        fallback={
          <div
            className="h-[60vh] w-full rounded-2xl border animate-pulse"
            style={{ background: "#fff", borderColor: "var(--border)" }}
          />
        }
      >
        <SearchableFestivals festivals={data || []} />
      </Suspense>
    </main>
  );
}
