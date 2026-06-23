"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase-server";
import type { Profile } from "../../lib/types";

/* ── Sign out ────────────────────────────────────────────────── */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/* ── OAuth: Google ───────────────────────────────────────────── */
export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  if (data.url) redirect(data.url);
}

/* ── Save / unsave a festival ────────────────────────────────── */
export async function toggleSaveFestival(
  festivalId: number,
  currentlySaved: boolean
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (currentlySaved) {
    const { error } = await supabase
      .from("saved_festivals")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("saved_festivals")
      .insert({ user_id: user.id, festival_id: festivalId });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return {};
}

/* ── Sync localStorage saves to DB on login ─────────────────── */
export async function syncLocalSaves(
  festivalIds: number[]
): Promise<{ error?: string }> {
  if (!festivalIds.length) return {};
  if (festivalIds.length > 500) return { error: "Too many IDs" };
  if (!festivalIds.every((id) => Number.isInteger(id) && id > 0 && id < 2_147_483_647))
    return { error: "Invalid festival IDs" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const rows = festivalIds.map((festival_id) => ({
    user_id: user.id,
    festival_id,
  }));

  const { error } = await supabase
    .from("saved_festivals")
    .upsert(rows, { onConflict: "user_id,festival_id", ignoreDuplicates: true });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return {};
}

// Fields users are allowed to update on their own profile.
type UserEditableProfile = Pick<Profile, "artist_name" | "country" | "primary_genre" | "instagram_url" | "spotify_url" | "website_url">;

/* ── Update profile ──────────────────────────────────────────── */
export async function updateProfile(
  data: Partial<UserEditableProfile>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Allowlist: only permit user-owned profile fields.
  // Never let callers touch is_premium, stripe_*, subscription_status, premium_until.
  const { artist_name, country, primary_genre, instagram_url, spotify_url, website_url } = data;
  const safeData: Partial<UserEditableProfile> = {};
  if (artist_name !== undefined)   safeData.artist_name   = artist_name;
  if (country     !== undefined)   safeData.country       = country;
  if (primary_genre !== undefined) safeData.primary_genre = primary_genre;
  if (instagram_url !== undefined) safeData.instagram_url = instagram_url;
  if (spotify_url !== undefined)   safeData.spotify_url   = spotify_url;
  if (website_url !== undefined)   safeData.website_url   = website_url;

  const { error } = await supabase
    .from("profiles")
    .update({ ...safeData, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  return {};
}

/* ── Track festival view ─────────────────────────────────────── */
export async function trackFestivalView(festivalId: number): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("festival_views").upsert(
    {
      user_id: user.id,
      festival_id: festivalId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,festival_id" }
  );
}
