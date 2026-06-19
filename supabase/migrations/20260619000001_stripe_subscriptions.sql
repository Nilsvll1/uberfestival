-- ─── User tables + Stripe subscription fields ────────────────────────────────
--
-- Creates profiles, saved_festivals, and festival_views if they don't exist,
-- then adds Stripe subscription columns to profiles.
-- Safe to run multiple times (all statements are idempotent).

-- ── 1. profiles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id                     UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  artist_name            TEXT,
  country                TEXT,
  primary_genre          TEXT,
  instagram_url          TEXT,
  spotify_url            TEXT,
  website_url            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Stripe subscription columns (idempotent)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_premium               BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_until            TIMESTAMPTZ;

-- Indexes for webhook lookups
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_idx
  ON profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ── 2. Auto-create a profile row on sign-up ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. saved_festivals ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS saved_festivals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  festival_id  INTEGER     NOT NULL REFERENCES festivals  ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, festival_id)
);

CREATE INDEX IF NOT EXISTS saved_festivals_user_idx ON saved_festivals (user_id);

-- ── 4. festival_views ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS festival_views (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  festival_id  INTEGER     NOT NULL REFERENCES festivals  ON DELETE CASCADE,
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, festival_id)
);

CREATE INDEX IF NOT EXISTS festival_views_user_idx ON festival_views (user_id);

-- ── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_views  ENABLE ROW LEVEL SECURITY;

-- profiles: users can read and write their own row
DROP POLICY IF EXISTS "profiles: own row" ON profiles;
CREATE POLICY "profiles: own row"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- saved_festivals: users manage their own rows
DROP POLICY IF EXISTS "saved_festivals: own rows" ON saved_festivals;
CREATE POLICY "saved_festivals: own rows"
  ON saved_festivals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- festival_views: users manage their own rows
DROP POLICY IF EXISTS "festival_views: own rows" ON festival_views;
CREATE POLICY "festival_views: own rows"
  ON festival_views FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
