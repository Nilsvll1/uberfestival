-- Collections: user-owned, optionally shareable festival playlists.
-- Each collection has a UUID slug for unguessable share links.

CREATE TABLE collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT CHECK (char_length(description) <= 500),
  slug        TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE collection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID    NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  festival_id   INTEGER NOT NULL REFERENCES festivals(id)  ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, festival_id)
);

CREATE INDEX collections_user_id_idx           ON collections(user_id);
CREATE INDEX collections_slug_idx              ON collections(slug);
CREATE INDEX collection_items_collection_id_idx ON collection_items(collection_id);
CREATE INDEX collection_items_festival_id_idx  ON collection_items(festival_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE collections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- Owner: full access to their own collections.
CREATE POLICY "collections_owner_all" ON collections
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Public read: anyone can read public collections.
CREATE POLICY "collections_public_read" ON collections
  FOR SELECT
  USING (is_public = true);

-- Owner: full access to items in their collections.
CREATE POLICY "collection_items_owner_all" ON collection_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
        AND c.user_id = auth.uid()
    )
  );

-- Public read: anyone can read items of public collections.
CREATE POLICY "collection_items_public_read" ON collection_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_items.collection_id
        AND c.is_public = true
    )
  );
