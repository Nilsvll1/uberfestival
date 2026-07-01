import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "./supabase-admin";

const todayStr = () => new Date().toISOString().slice(0, 10);
const CLOSED = '("seasonally_closed","unknown")';

const FIELDS =
  "id, festival_name, city, country, category, application_status, submission_deadline, hero_image_url, application_url" as const;

type FestivalRow = {
  id: number;
  festival_name: string | null;
  city: string | null;
  country: string | null;
  category: string | null;
  application_status: string | null;
  submission_deadline: string | null;
  hero_image_url: string | null;
  application_url: string | null;
};

export type RecommendationReason = {
  label: string;
  type: "genre" | "country" | "popular" | "verified" | "deadline" | "collaborative" | "applied";
};

export type RecommendedFestival = Omit<FestivalRow, "application_url"> & {
  has_apply_url: boolean;
  score: number;
  reasons: RecommendationReason[];
};

function strip(f: FestivalRow, score: number, reasons: RecommendationReason[]): RecommendedFestival {
  const { application_url, ...rest } = f;
  return { ...rest, has_apply_url: !!application_url, score, reasons };
}

// ── 1. Similar festivals (content-based) ──────────────────────────────────
export const getSimilarFestivals = unstable_cache(
  async (
    festivalId: number,
    category: string | null,
    country: string | null,
    applicationStatus: string | null,
  ): Promise<RecommendedFestival[]> => {
    if (!category && !country) return [];

    let q = supabaseAdmin
      .from("festivals")
      .select(FIELDS)
      .neq("id", festivalId)
      .gte("submission_deadline", todayStr())
      .not("application_status", "in", CLOSED)
      .limit(60);

    if (category && country) q = q.or(`category.eq.${category},country.eq.${country}`);
    else if (category) q = q.eq("category", category);
    else if (country) q = q.eq("country", country);

    const { data } = await q;

    return (data ?? [])
      .map((f) => {
        let score = 0;
        const reasons: RecommendationReason[] = [];
        if (f.category === category) { score += 3; reasons.push({ label: "Same genre", type: "genre" }); }
        if (f.country === country) { score += 2; reasons.push({ label: "Same country", type: "country" }); }
        if (applicationStatus && !["seasonally_closed", "unknown"].includes(applicationStatus)
            && f.application_status === applicationStatus) {
          score += 1;
        }
        return strip(f as FestivalRow, score, reasons);
      })
      .sort((a, b) =>
        b.score - a.score ||
        (a.submission_deadline ?? "9999").localeCompare(b.submission_deadline ?? "9999")
      )
      .slice(0, 6);
  },
  ["similar-festivals"],
  { revalidate: 6 * 3600, tags: ["festivals"] }
);

// ── 2. People also saved (collaborative filtering on saved_festivals) ───────
export const getPeopleAlsoSaved = unstable_cache(
  async (festivalId: number): Promise<RecommendedFestival[]> => {
    const { data: coSavers } = await supabaseAdmin
      .from("saved_festivals")
      .select("user_id")
      .eq("festival_id", festivalId)
      .limit(100);

    if (!coSavers?.length) return [];

    const userIds = coSavers.map((r) => r.user_id);

    const { data: coSaved } = await supabaseAdmin
      .from("saved_festivals")
      .select("festival_id")
      .in("user_id", userIds)
      .neq("festival_id", festivalId)
      .limit(600);

    if (!coSaved?.length) return [];

    const counts = new Map<number, number>();
    for (const row of coSaved) {
      counts.set(row.festival_id, (counts.get(row.festival_id) ?? 0) + 1);
    }

    const topIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id);

    if (!topIds.length) return [];

    const { data: festivals } = await supabaseAdmin
      .from("festivals")
      .select(FIELDS)
      .in("id", topIds)
      .gte("submission_deadline", todayStr())
      .not("application_status", "in", CLOSED);

    if (!festivals?.length) return [];

    return (festivals as FestivalRow[])
      .map((f) =>
        strip(f, counts.get(f.id) ?? 0, [
          { label: "Artists like you also saved this", type: "collaborative" },
        ])
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  },
  ["people-also-saved"],
  { revalidate: 6 * 3600, tags: ["festivals"] }
);

// ── 3. Personalized feed (hybrid: genre + country + popularity + urgency) ──
export const getPersonalizedFeed = unstable_cache(
  async (
    userId: string,
    genre: string | null,
    country: string | null,
  ): Promise<RecommendedFestival[]> => {
    const today = todayStr();
    const empty: FestivalRow[] = []; // used as fallback when genre/country is null

    const [savedResult, appliedResult] = await Promise.all([
      supabaseAdmin.from("saved_festivals").select("festival_id").eq("user_id", userId),
      supabaseAdmin.from("application_history").select("festival_id").eq("user_id", userId),
    ]);

    const excludeIds = new Set<number>([
      ...(savedResult.data ?? []).map((r) => r.festival_id),
      ...(appliedResult.data ?? []).map((r) => r.festival_id),
    ]);

    const [genrePool, countryPool, verifiedPool] = await Promise.all([
      genre
        ? supabaseAdmin
            .from("festivals")
            .select(FIELDS)
            .eq("category", genre)
            .gte("submission_deadline", today)
            .not("application_status", "in", CLOSED)
            .order("submission_deadline", { ascending: true })
            .limit(40)
            .then((r) => (r.data ?? []) as FestivalRow[])
        : Promise.resolve(empty),
      country
        ? supabaseAdmin
            .from("festivals")
            .select(FIELDS)
            .eq("country", country)
            .gte("submission_deadline", today)
            .not("application_status", "in", CLOSED)
            .order("submission_deadline", { ascending: true })
            .limit(30)
            .then((r) => (r.data ?? []) as FestivalRow[])
        : Promise.resolve(empty),
      supabaseAdmin
        .from("festivals")
        .select(FIELDS)
        .eq("application_status", "verified_application")
        .gte("submission_deadline", today)
        .order("updated_at", { ascending: false })
        .limit(20)
        .then((r) => (r.data ?? []) as FestivalRow[]),
    ]);

    // Merge and deduplicate
    const merged = new Map<number, FestivalRow>();
    for (const f of [...genrePool, ...countryPool, ...verifiedPool]) {
      if (!merged.has(f.id)) merged.set(f.id, f);
    }

    const candidateIds = [...merged.keys()];
    if (!candidateIds.length) return [];

    // Popularity: save counts across all users
    const [saveRows, applyRows] = await Promise.all([
      supabaseAdmin.from("saved_festivals").select("festival_id").in("festival_id", candidateIds),
      supabaseAdmin.from("application_history").select("festival_id").in("festival_id", candidateIds),
    ]);

    const saveCountMap = new Map<number, number>();
    for (const r of saveRows.data ?? []) {
      saveCountMap.set(r.festival_id, (saveCountMap.get(r.festival_id) ?? 0) + 1);
    }

    const applyCountMap = new Map<number, number>();
    for (const r of applyRows.data ?? []) {
      applyCountMap.set(r.festival_id, (applyCountMap.get(r.festival_id) ?? 0) + 1);
    }

    const nowMs = Date.now();
    const results: RecommendedFestival[] = [];

    for (const f of merged.values()) {
      if (excludeIds.has(f.id)) continue;

      let score = 0;
      const reasons: RecommendationReason[] = [];

      if (genre && f.category === genre) {
        score += 3;
        reasons.push({ label: "Matches your genre", type: "genre" });
      }
      if (country && f.country === country) {
        score += 2;
        reasons.push({ label: "From your country", type: "country" });
      }

      const saves = saveCountMap.get(f.id) ?? 0;
      if (saves >= 5) {
        score += Math.min(saves / 10, 2);
        reasons.push({ label: `${saves} saves`, type: "popular" });
      }

      const applied = applyCountMap.get(f.id) ?? 0;
      if (applied >= 3) {
        score += Math.min(applied / 5, 1.5);
        reasons.push({ label: `${applied} applied`, type: "applied" });
      }

      if (f.application_status === "verified_application") {
        score += 0.5;
        reasons.push({ label: "Verified", type: "verified" });
      }

      if (f.submission_deadline) {
        const daysLeft = Math.ceil(
          (new Date(f.submission_deadline).getTime() - nowMs) / 86_400_000
        );
        if (daysLeft >= 14 && daysLeft <= 90) {
          score += 1;
          reasons.push({ label: `${daysLeft}d left`, type: "deadline" });
        }
      }

      if (score <= 0) continue;

      results.push(strip(f, score, reasons));
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 30);
  },
  ["personalized-feed"],
  { revalidate: 3600, tags: ["festivals"] }
);
