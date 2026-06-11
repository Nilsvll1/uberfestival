"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase-server";

// Service-role client for writes that bypass RLS.
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const adminEmails = (process.env.ADMIN_EMAIL ?? "").split(",").map((e) => e.trim());
  if (!adminEmails.includes(user.email ?? "")) throw new Error("Forbidden");

  return user;
}

// ─── Staging actions ──────────────────────────────────────────────────────────

export async function approveStaging(id: number, overrides: Record<string, string> = {}) {
  await requireAdmin();
  const db = serviceClient();

  const { data: staged, error: fetchError } = await db
    .from("festival_staging")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !staged) throw new Error("Staging item not found");

  // Geocode city/country → lat/lon via OpenStreetMap Nominatim (free, no key required).
  const { lat, lon } = await geocode(
    overrides.city ?? staged.city,
    overrides.country ?? staged.country
  );

  const festival = {
    festival_name: overrides.festival_name ?? staged.festival_name ?? "Unnamed Festival",
    country: overrides.country ?? staged.country,
    city: overrides.city ?? staged.city,
    category: overrides.genre ?? staged.genre,
    application_url: overrides.application_url ?? staged.application_url,
    submission_deadline: overrides.submission_deadline ?? staged.submission_deadline,
    festival_start_date: staged.festival_start_date,
    festival_end_date: staged.festival_end_date,
    website: staged.website,
    social_links: staged.social_links,
    source_url: staged.source_url,
    latitude: lat,
    longitude: lon,
    scrape_status: "ok",
    is_verified: true,
    last_scraped_at: new Date().toISOString(),
  };

  const { error: insertError } = await db.from("festivals").insert(festival);
  if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

  await db.from("festival_staging").update({ status: "approved" }).eq("id", id);

  revalidatePath("/dashboard/admin");
}

export async function rejectStaging(id: number) {
  await requireAdmin();
  const db = serviceClient();
  await db.from("festival_staging").update({ status: "rejected" }).eq("id", id);
  revalidatePath("/dashboard/admin");
}

export async function updateFestival(id: number, fields: Record<string, string>) {
  await requireAdmin();
  const db = serviceClient();
  await db.from("festivals").update({ ...fields, scrape_status: "ok" }).eq("id", id);
  revalidatePath("/dashboard/admin");
}

export async function markFestivalVerified(id: number) {
  await requireAdmin();
  const db = serviceClient();
  await db.from("festivals").update({ is_verified: true, scrape_status: "ok" }).eq("id", id);
  revalidatePath("/dashboard/admin");
}

export async function addScrapeSource(name: string, url: string) {
  await requireAdmin();
  const db = serviceClient();
  const { error } = await db.from("scrape_sources").insert({ name, url });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

export async function toggleSource(id: number, isActive: boolean) {
  await requireAdmin();
  const db = serviceClient();
  await db.from("scrape_sources").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/dashboard/admin");
}

export async function addFestivalManually(fields: {
  festival_name: string;
  country?: string;
  city?: string;
  genre?: string;
  application_url?: string;
  submission_deadline?: string;
  website?: string;
}) {
  await requireAdmin();
  const db = serviceClient();

  const { lat, lon } = await geocode(fields.city, fields.country);

  const { error } = await db.from("festivals").insert({
    festival_name: fields.festival_name,
    country: fields.country ?? null,
    city: fields.city ?? null,
    category: fields.genre ?? null,
    application_url: fields.application_url ?? null,
    submission_deadline: fields.submission_deadline ?? null,
    website: fields.website ?? null,
    latitude: lat,
    longitude: lon,
    scrape_status: "ok",
    is_verified: true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin");
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

async function geocode(city?: string | null, country?: string | null) {
  if (!city && !country) return { lat: 0, lon: 0 };

  const q = [city, country].filter(Boolean).join(", ");
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { "User-Agent": "UberFestivalApp/1.0" } }
    );
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    // Geocoding is best-effort. The admin can fix coordinates manually.
  }
  return { lat: 0, lon: 0 };
}
