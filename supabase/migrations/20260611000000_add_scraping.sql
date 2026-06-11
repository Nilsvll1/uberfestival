-- ─── Extend festivals table ─────────────────────────────────────────────────
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS festival_start_date  date,
  ADD COLUMN IF NOT EXISTS festival_end_date    date,
  ADD COLUMN IF NOT EXISTS website              text,
  ADD COLUMN IF NOT EXISTS social_links         jsonb    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_scraped_at      timestamptz,
  ADD COLUMN IF NOT EXISTS scrape_status        text     DEFAULT 'pending',
  -- 'pending' | 'ok' | 'failed' | 'dead_link' | 'manual_review'
  ADD COLUMN IF NOT EXISTS scrape_error         text,
  ADD COLUMN IF NOT EXISTS source_url           text,
  ADD COLUMN IF NOT EXISTS is_verified          boolean  DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at           timestamptz DEFAULT now();

-- Keep updated_at current on every write
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS festivals_updated_at ON festivals;
CREATE TRIGGER festivals_updated_at
  BEFORE UPDATE ON festivals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Staging: auto-discovered festivals waiting for admin review ──────────────
CREATE TABLE IF NOT EXISTS festival_staging (
  id                  bigserial PRIMARY KEY,
  festival_name       text,
  country             text,
  city                text,
  genre               text,
  application_url     text,
  submission_deadline text,
  festival_start_date date,
  festival_end_date   date,
  website             text,
  social_links        jsonb DEFAULT '{}',
  source_url          text NOT NULL,
  raw_text            text,
  status              text DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected'
  created_at          timestamptz DEFAULT now()
);

-- ─── Sources: pages to crawl for new festival discovery ──────────────────────
CREATE TABLE IF NOT EXISTS scrape_sources (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,
  url             text NOT NULL UNIQUE,
  is_active       boolean DEFAULT true,
  last_scraped_at timestamptz,
  festivals_found integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Seed a handful of known listing pages (admin can add more via the UI).
-- These are pages that aggregate open calls / festival opportunities.
INSERT INTO scrape_sources (name, url) VALUES
  ('INES Music Festival Directory',      'https://www.musicfestivalnews.com/festivals/'),
  ('Jazz Corner Festival Listings',      'https://www.jazzcorner.com/festivals/'),
  ('Festival Finder',                    'https://www.festivalhunter.com/'),
  ('Open Call Listing — ResArtis',       'https://www.resartis.org/residencies')
ON CONFLICT (url) DO NOTHING;
