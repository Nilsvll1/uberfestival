import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "../../../lib/supabase-server";
import {
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  isValidLanguage,
} from "../../../lib/i18n";
import type { Festival } from "../../../lib/types";
import FestivalCard from "../../components/FestivalCard";

type ItemRow = {
  festival_id: number;
  festivals: Omit<Festival, "application_url">;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("collections")
    .select("name")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!data) return { title: "Collection | UberFestival" };
  return { title: `${(data as { name: string }).name} | UberFestival` };
}

export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = await createClient();
  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, description, slug, created_at")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!collection) notFound();

  const col = collection as {
    id: string;
    name: string;
    description?: string | null;
    slug: string;
    created_at: string;
  };

  const { data: itemRows } = await supabase
    .from("collection_items")
    .select(
      "festival_id, festivals(id, festival_name, city, country, category, application_status, submission_deadline, hero_image_url, website, latitude, longitude)"
    )
    .eq("collection_id", col.id)
    .order("added_at", { ascending: false });

  const { data: { user } } = await supabase.auth.getUser();

  let savedIds: number[] = [];
  if (user) {
    const { data: saved } = await supabase
      .from("saved_festivals")
      .select("festival_id")
      .eq("user_id", user.id);
    savedIds = (saved ?? []).map((r: { festival_id: number }) => r.festival_id);
  }

  const festivals = ((itemRows ?? []) as unknown as ItemRow[])
    .map(r => r.festivals)
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return (
    <main className="max-w-[960px] mx-auto px-5 lg:px-8 py-10 lg:py-14">

      {/* Header */}
      <div className="mb-10">
        <p
          className="uppercase font-semibold tracking-[0.1em] mb-3"
          style={{ fontSize: "10px", color: "var(--text-muted)" }}
        >
          {lang === "fr" ? "Collection partagée" : "Shared collection"}
        </p>
        <h1
          className="font-extrabold leading-tight"
          style={{
            fontSize: "clamp(1.6rem, 4vw, 2.4rem)",
            letterSpacing: "-0.04em",
            color: "var(--text-primary)",
          }}
        >
          {col.name}
        </h1>
        {col.description && (
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: 6 }}>
            {col.description}
          </p>
        )}
        <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 6 }}>
          {festivals.length}{" "}
          {lang === "fr"
            ? `festival${festivals.length !== 1 ? "s" : ""}`
            : `festival${festivals.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Festival grid */}
      {festivals.length === 0 ? (
        <div
          className="rounded-[18px] border flex flex-col items-center justify-center gap-4 py-16 text-center"
          style={{ borderColor: "var(--border)", background: "#fff", borderStyle: "dashed" }}
        >
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            {lang === "fr" ? "Cette collection est vide." : "This collection is empty."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {festivals.map((festival, i) => (
            <FestivalCard
              key={festival.id}
              festival={festival as Festival}
              index={i}
              lang={lang}
              userId={user?.id ?? null}
              initialSaved={savedIds.includes(festival.id)}
              isPremium={null}
            />
          ))}
        </div>
      )}

      {/* CTA */}
      <div
        className="mt-16 rounded-[20px] border p-8 flex flex-col sm:flex-row items-center gap-6"
        style={{ background: "rgba(99,102,241,0.04)", borderColor: "rgba(99,102,241,0.15)" }}
      >
        <div className="flex-1">
          <h2
            className="font-extrabold"
            style={{ fontSize: "1.25rem", letterSpacing: "-0.03em", color: "var(--text-primary)" }}
          >
            {lang === "fr"
              ? "Découvre des milliers de festivals"
              : "Discover thousands of festivals"}
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginTop: 4 }}>
            {lang === "fr"
              ? "Crée des collections, suis les deadlines et postule directement."
              : "Create collections, track deadlines, and apply directly."}
          </p>
        </div>
        <Link
          href="/explore"
          className="btn-cta inline-flex items-center gap-2 font-semibold rounded-[12px] px-5 py-3 shrink-0"
          style={{ fontSize: "14px", textDecoration: "none" }}
        >
          {lang === "fr" ? "Explorer UberFestival →" : "Explore UberFestival →"}
        </Link>
      </div>
    </main>
  );
}
