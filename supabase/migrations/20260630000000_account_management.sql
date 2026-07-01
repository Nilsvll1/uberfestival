-- ─── Account management: avatar + notification preferences ──────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT
    '{"email_deadlines": true, "email_new_opportunities": false, "email_product_updates": true}'::jsonb;

-- ─── Avatars storage bucket ───────────────────────────────────────────────────
-- Public bucket — URLs are readable without auth (no signing required).
-- Write access is restricted to each user's own folder via RLS below.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Storage RLS — avatars ───────────────────────────────────────────────────
-- Each user can only read/write objects in a folder named after their user ID.
-- e.g. {user-uuid}/avatar  or  {user-uuid}/avatar.jpg

DROP POLICY IF EXISTS "ubf_avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "ubf_avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "ubf_avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "ubf_avatars_select" ON storage.objects;

CREATE POLICY "ubf_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ubf_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ubf_avatars_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read: the bucket is already public, but explicit policy for clarity.
CREATE POLICY "ubf_avatars_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
