"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase-server";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NotificationPrefs, Profile } from "../../lib/types";

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

/* ── Update password (recovery flow) ────────────────────────── */
export async function updatePassword(
  password: string
): Promise<{ error?: string }> {
  if (!password || password.length < 8)
    return { error: "Password must be at least 8 characters" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return {};
}

/* ── Delete account (requires admin key, server-only) ────────── */
export async function deleteAccount(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Deletes from auth.users; FK cascade removes profiles + saved_festivals + festival_views.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/* ── Export user data (GDPR) ─────────────────────────────────── */
export async function exportUserData(): Promise<{ data?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [profileRes, savedRes, viewsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "artist_name, country, primary_genre, instagram_url, spotify_url, website_url, notification_prefs, is_premium, created_at, updated_at"
      )
      .eq("id", user.id)
      .single(),
    supabase.from("saved_festivals").select("festival_id, saved_at").eq("user_id", user.id),
    supabase.from("festival_views").select("festival_id, viewed_at").eq("user_id", user.id),
  ]);

  const payload = {
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profileRes.data ?? null,
    saved_festivals: savedRes.data ?? [],
    recently_viewed: viewsRes.data ?? [],
    exported_at: new Date().toISOString(),
  };

  return { data: JSON.stringify(payload, null, 2) };
}

/* ── Update notification preferences ────────────────────────── */
export async function updateNotificationPrefs(
  prefs: NotificationPrefs
): Promise<{ error?: string }> {
  if (
    typeof prefs.email_deadlines !== "boolean" ||
    typeof prefs.email_new_opportunities !== "boolean" ||
    typeof prefs.email_product_updates !== "boolean"
  )
    return { error: "Invalid preferences" };
  if (
    "email_reopening_alerts" in prefs &&
    typeof prefs.email_reopening_alerts !== "boolean"
  )
    return { error: "Invalid preferences" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: prefs, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/privacy");
  return {};
}

/* ── Update avatar URL ───────────────────────────────────────── */
export async function updateAvatarUrl(url: string): Promise<{ error?: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url.startsWith(`${supabaseUrl}/storage/`))
    return { error: "Invalid avatar URL" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
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
