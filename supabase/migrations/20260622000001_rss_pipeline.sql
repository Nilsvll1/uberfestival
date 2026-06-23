-- ─── RSS Ingestion Pipeline ───────────────────────────────────────────────────
--
-- New tables:
--   rss_feeds         — managed list of RSS/Atom sources (admin-controlled)
--   pipeline_runs     — one row per weekly execution (the audit log header)
--   pipeline_run_events — per-item log lines for each run
--
-- Alterations to festivals:
--   is_archived / archived_at — soft-delete for obsolete opportunities
--   last_seen_at              — set every time an RSS item matches this record
--
-- The explore page must filter WHERE is_archived IS NOT TRUE.

-- ── 1. RSS feeds table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rss_feeds (
  id                 BIGSERIAL    PRIMARY KEY,
  name               TEXT         NOT NULL,
  url                TEXT         NOT NULL UNIQUE
                     CHECK (url ~* '^https?://'),
  feed_type          TEXT         NOT NULL DEFAULT 'rss',
  -- 'rss' (RSS 2.0 or 1.0), 'atom' (Atom 1.0)
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  last_fetched_at    TIMESTAMPTZ,
  last_fetch_status  TEXT,
  -- 'ok' | 'failed' | 'empty' | 'parse_error'
  items_last_run     INTEGER      NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 2. Pipeline run header ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id                  BIGSERIAL    PRIMARY KEY,
  started_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  status              TEXT         NOT NULL DEFAULT 'running',
  -- 'running' | 'completed' | 'failed'
  feeds_processed     INTEGER      NOT NULL DEFAULT 0,
  items_found         INTEGER      NOT NULL DEFAULT 0,
  festivals_created   INTEGER      NOT NULL DEFAULT 0,
  festivals_updated   INTEGER      NOT NULL DEFAULT 0,
  festivals_archived  INTEGER      NOT NULL DEFAULT 0,
  errors_count        INTEGER      NOT NULL DEFAULT 0,
  duration_ms         INTEGER,
  error_message       TEXT,
  -- Full JSON summary stored for the admin dashboard
  summary             JSONB
);

-- ── 3. Per-item log entries ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pipeline_run_events (
  id          BIGSERIAL    PRIMARY KEY,
  run_id      BIGINT       NOT NULL REFERENCES pipeline_runs ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  level       TEXT         NOT NULL DEFAULT 'info',
  -- 'info' | 'warn' | 'error'
  event_type  TEXT         NOT NULL,
  -- 'feed_fetch' | 'item_skip' | 'festival_created' | 'festival_updated'
  -- | 'festival_archived' | 'parse_error' | 'geocode' | 'run_complete'
  message     TEXT         NOT NULL,
  data        JSONB
);

CREATE INDEX IF NOT EXISTS pipeline_run_events_run_idx
  ON pipeline_run_events (run_id, created_at DESC);

-- ── 4. Add archival + tracking columns to festivals ───────────────────────────

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS is_archived   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
  -- last_seen_at: updated every time a pipeline run finds an RSS item
  -- matching this festival, proving it is still being advertised.

-- Partial index so "WHERE is_archived IS NOT TRUE" is fast.
CREATE INDEX IF NOT EXISTS festivals_not_archived_idx
  ON festivals (id)
  WHERE is_archived = false;

-- ── 5. RLS: pipeline tables are service-role only ─────────────────────────────
-- Regular users never need to read or write these tables directly.
-- The admin UI fetches them through Server Actions using supabaseAdmin.

ALTER TABLE rss_feeds          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_run_events ENABLE ROW LEVEL SECURITY;

-- No SELECT policy → anon/authed keys see nothing; service_role bypasses RLS.

-- ── 6. Seed initial RSS feeds ─────────────────────────────────────────────────

INSERT INTO rss_feeds (name, url, feed_type) VALUES
  -- Music industry opportunity aggregators
  ('INES Music — News Feed',
   'https://www.musicnewsnet.com/feed/',
   'rss'),
  ('Music Business Worldwide',
   'https://www.musicbusinessworldwide.com/feed/',
   'rss'),
  -- European festival submission opportunities
  ('EFG London Jazz Festival — News',
   'https://efglondonjazzfestival.org.uk/feed/',
   'rss'),
  -- UK live music industry
  ('Association of Independent Festivals',
   'https://www.aiforg.com/feed/',
   'rss'),
  -- Global arts opportunities
  ('ResArtis Opportunities',
   'https://www.resartis.org/en/residencies.rss',
   'rss'),
  -- Festival & event industry
  ('Eventbrite Blog',
   'https://www.eventbrite.com/blog/feed/',
   'rss')
ON CONFLICT (url) DO NOTHING;
