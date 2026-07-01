"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../lib/supabase-server";

export async function createCollection(name: string): Promise<{ id?: string; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) return { error: "Name must be 1–100 characters" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: trimmed })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return { id: (data as { id: string }).id };
}

export async function renameCollection(id: string, name: string): Promise<{ error?: string }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) return { error: "Name must be 1–100 characters" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collections")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/collections/${id}`);
  return {};
}

export async function deleteCollection(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  return {};
}

export async function addToCollection(
  collectionId: string,
  festivalId: number
): Promise<{ error?: string }> {
  if (!Number.isInteger(festivalId) || festivalId <= 0) return { error: "Invalid festival" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collection_items")
    .upsert(
      { collection_id: collectionId, festival_id: festivalId },
      { onConflict: "collection_id,festival_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/collections/${collectionId}`);
  return {};
}

export async function removeFromCollection(
  collectionId: string,
  festivalId: number
): Promise<{ error?: string }> {
  if (!Number.isInteger(festivalId) || festivalId <= 0) return { error: "Invalid festival" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("festival_id", festivalId);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/collections/${collectionId}`);
  return {};
}

export async function moveToCollection(
  fromCollectionId: string,
  festivalId: number,
  toCollectionId: string
): Promise<{ error?: string }> {
  if (!Number.isInteger(festivalId) || festivalId <= 0) return { error: "Invalid festival" };
  if (fromCollectionId === toCollectionId) return {};

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { count } = await supabase
    .from("collections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("id", [fromCollectionId, toCollectionId]);

  if ((count ?? 0) < 2) return { error: "Collection not found" };

  const [removeResult, addResult] = await Promise.all([
    supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", fromCollectionId)
      .eq("festival_id", festivalId),
    supabase
      .from("collection_items")
      .upsert(
        { collection_id: toCollectionId, festival_id: festivalId },
        { onConflict: "collection_id,festival_id", ignoreDuplicates: true }
      ),
  ]);

  if (removeResult.error) return { error: removeResult.error.message };
  if (addResult.error) return { error: addResult.error.message };
  revalidatePath(`/dashboard/collections/${fromCollectionId}`);
  revalidatePath(`/dashboard/collections/${toCollectionId}`);
  return {};
}

export async function toggleCollectionPublic(
  id: string
): Promise<{ isPublic?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: current } = await supabase
    .from("collections")
    .select("is_public")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!current) return { error: "Collection not found" };

  const newPublic = !(current as { is_public: boolean }).is_public;
  const { error } = await supabase
    .from("collections")
    .update({ is_public: newPublic, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath(`/dashboard/collections/${id}`);
  return { isPublic: newPublic };
}

export async function exportCollectionCSV(
  collectionId: string
): Promise<{ csv?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [collectionResult, profileResult] = await Promise.all([
    supabase
      .from("collections")
      .select("name")
      .eq("id", collectionId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", user.id)
      .single(),
  ]);

  if (!collectionResult.data) return { error: "Collection not found" };

  const { data: rawItems } = await supabase
    .from("collection_items")
    .select("added_at, festivals(id, festival_name, city, country, category, application_status, submission_deadline, website, application_url)")
    .eq("collection_id", collectionId)
    .order("added_at", { ascending: false });

  if (!rawItems) return { error: "Failed to fetch items" };

  const isPremium = (profileResult.data as { is_premium?: boolean } | null)?.is_premium === true;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const header = [
    "Festival Name", "City", "Country", "Genre",
    "Deadline", "Application Method", "Apply Link", "Added Date",
  ].join(",");

  const rows = (rawItems as unknown as Array<{ added_at: string; festivals: Record<string, unknown> }>)
    .map(item => {
      const f = item.festivals ?? {};
      const applyLink = isPremium && f.application_url
        ? `${siteUrl}/api/apply/${f.id}`
        : String(f.website ?? "");
      return [
        f.festival_name ?? "", f.city ?? "", f.country ?? "", f.category ?? "",
        f.submission_deadline ?? "", f.application_status ?? "",
        applyLink, item.added_at.slice(0, 10),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

  return { csv: [header, ...rows].join("\n") };
}
