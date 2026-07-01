import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "../../../../lib/supabase-server";
import {
  DEFAULT_LANGUAGE,
  LANG_COOKIE,
  isValidLanguage,
} from "../../../../lib/i18n";
import type { Festival, Collection } from "../../../../lib/types";
import CollectionClient from "./CollectionClient";

export const metadata: Metadata = { title: "Collection | UberFestival" };

type ItemRow = {
  festival_id: number;
  added_at: string;
  festivals: Festival & { application_url?: string | null };
};

type SavedRow = {
  festival_id: number;
  festivals: Pick<
    Festival,
    "id" | "festival_name" | "city" | "country" | "category" | "application_status" | "hero_image_url"
  >;
};

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const cookieStore = await cookies();
  const rawLang = cookieStore.get(LANG_COOKIE)?.value;
  const lang = isValidLanguage(rawLang) ? rawLang : DEFAULT_LANGUAGE;

  const [collectionResult, itemsResult, savedResult, otherCollectionsResult, profileResult] =
    await Promise.all([
      supabase
        .from("collections")
        .select("id, name, description, slug, is_public, created_at, updated_at, user_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("collection_items")
        .select(
          "festival_id, added_at, festivals(id, festival_name, city, country, category, application_status, submission_deadline, hero_image_url, website, application_url)"
        )
        .eq("collection_id", id)
        .order("added_at", { ascending: false }),
      supabase
        .from("saved_festivals")
        .select(
          "festival_id, festivals(id, festival_name, city, country, category, application_status, hero_image_url)"
        )
        .eq("user_id", user.id)
        .order("saved_at", { ascending: false }),
      supabase
        .from("collections")
        .select("id, name")
        .eq("user_id", user.id)
        .neq("id", id)
        .order("name"),
      supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .single(),
    ]);

  if (collectionResult.error || !collectionResult.data) notFound();

  const collection = collectionResult.data as unknown as Collection;
  const itemRows = (itemsResult.data ?? []) as unknown as ItemRow[];
  const savedRows = (savedResult.data ?? []) as unknown as SavedRow[];
  const otherCollections = (otherCollectionsResult.data ?? []) as unknown as {
    id: string;
    name: string;
  }[];
  const isPremium =
    (profileResult.data as { is_premium?: boolean } | null)?.is_premium === true;

  // Strip application_url before passing to client component.
  const items = itemRows
    .map(row => {
      if (!row.festivals) return null;
      const { application_url, ...rest } = row.festivals;
      return { ...rest, has_apply_url: !!application_url, added_at: row.added_at };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  const inCollectionIds = new Set(items.map(f => f.id));

  // Saved festivals available to add (not already in this collection).
  const availableToAdd = savedRows
    .map(r => r.festivals)
    .filter(
      (f): f is NonNullable<typeof f> => f !== null && !inCollectionIds.has((f as { id: number }).id)
    );

  const savedFestivalIds = savedRows.map(r => r.festival_id);

  return (
    <CollectionClient
      collection={collection}
      initialItems={items as CollectionFestivalForClient[]}
      availableToAdd={availableToAdd as SavedFestivalForAdd[]}
      savedFestivalIds={savedFestivalIds}
      otherCollections={otherCollections}
      userId={user.id}
      isPremium={isPremium}
      lang={lang}
    />
  );
}

// These types are defined here so they can be shared with the client file without
// a separate types module.
export type CollectionFestivalForClient = Omit<Festival, "application_url"> & {
  has_apply_url?: boolean;
  added_at: string;
};

export type SavedFestivalForAdd = Pick<
  Festival,
  "id" | "festival_name" | "city" | "country" | "category" | "application_status" | "hero_image_url"
>;
