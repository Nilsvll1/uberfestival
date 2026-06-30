import type { MetadataRoute } from "next";
import { supabaseAdmin } from "../lib/supabase-admin";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://uberfestival.com";

export const revalidate = 86400; // regenerate daily

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: festivals } = await supabaseAdmin
    .from("festivals")
    .select("id, festival_name")
    .neq("is_archived", true);

  const festivalUrls: MetadataRoute.Sitemap = (festivals ?? []).map((f) => ({
    url: `${BASE_URL}/festival/${f.id}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/explore`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...festivalUrls,
  ];
}
