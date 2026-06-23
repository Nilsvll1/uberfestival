-- ─── Security hardening: profiles table ──────────────────────────────────────
--
-- Problem: The existing RLS policy "profiles: own row" allows authenticated
-- users to UPDATE their own row with ANY values, including is_premium,
-- stripe_customer_id, stripe_subscription_id, subscription_status, and
-- premium_until. A user can call the Supabase REST API directly with their
-- own JWT and set is_premium = true to bypass the Stripe payment wall.
--
-- Fix: A BEFORE UPDATE trigger that raises an exception when an authenticated
-- user (auth.uid() IS NOT NULL) attempts to modify the system-managed Stripe /
-- subscription fields. The service role key (used by the webhook) bypasses
-- this check because auth.uid() returns NULL for service_role calls.
--
-- This is defense-in-depth on top of the Server Action allowlist. Both must
-- be circumvented for an attack to succeed.

CREATE OR REPLACE FUNCTION public.prevent_premium_self_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- auth.uid() is NULL when called via the service_role key (webhooks, admin
  -- scripts). Only enforce when an actual user JWT is present.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    RAISE EXCEPTION 'permission denied: cannot modify is_premium'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'permission denied: cannot modify stripe_customer_id'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    RAISE EXCEPTION 'permission denied: cannot modify stripe_subscription_id'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'permission denied: cannot modify subscription_status'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.premium_until IS DISTINCT FROM OLD.premium_until THEN
    RAISE EXCEPTION 'permission denied: cannot modify premium_until'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_premium_immutability ON public.profiles;
CREATE TRIGGER enforce_premium_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_premium_self_grant();

-- ─── Index: festival listing query performance ────────────────────────────────
--
-- The /explore page queries festivals with no WHERE clause and returns all
-- ~1100 rows. Add indexes for the fields most commonly used in client-side
-- filtering (category) and sorting (submission_deadline), and for the admin
-- scrape status queries.

CREATE INDEX IF NOT EXISTS festivals_category_idx
  ON festivals (category)
  WHERE category IS NOT NULL;

CREATE INDEX IF NOT EXISTS festivals_deadline_idx
  ON festivals (submission_deadline)
  WHERE submission_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS festivals_country_idx
  ON festivals (country)
  WHERE country IS NOT NULL;

CREATE INDEX IF NOT EXISTS festivals_verified_idx
  ON festivals (is_verified)
  WHERE is_verified = true;

CREATE INDEX IF NOT EXISTS festivals_scrape_status_idx
  ON festivals (scrape_status)
  WHERE scrape_status IS NOT NULL;

-- ─── Health: validate profile url fields are http/https ───────────────────────
--
-- Prevent storing arbitrary data in URL fields (e.g. javascript: URIs).
-- These constraints are enforced at the DB layer regardless of the calling
-- client.

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_instagram_url_check,
  DROP CONSTRAINT IF EXISTS profiles_spotify_url_check,
  DROP CONSTRAINT IF EXISTS profiles_website_url_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_instagram_url_check
    CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
  ADD CONSTRAINT profiles_spotify_url_check
    CHECK (spotify_url   IS NULL OR spotify_url   ~* '^https?://'),
  ADD CONSTRAINT profiles_website_url_check
    CHECK (website_url   IS NULL OR website_url   ~* '^https?://');
