-- ─────────────────────────────────────────────────────────────────────────────
-- Application Link Reliability
--
-- Adds per-URL validation metadata to the festivals table and an audit log
-- (application_link_checks) that records every HTTP probe the pipeline runs.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS application_url_secondary  TEXT,
  ADD COLUMN IF NOT EXISTS link_check_status          TEXT        NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS link_check_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS link_check_http_status     INT,
  ADD COLUMN IF NOT EXISTS link_last_ok_at            TIMESTAMPTZ;

-- link_check_status values:
--   ok                 — URL returned 200, page looks like a valid apply page
--   not_found          — HTTP 404 / 410 / other 4xx
--   redirect_unrelated — follows redirects to an unrelated external domain
--   parked             — domain is parked for sale
--   login_wall         — page requires login with no visible apply content
--   expired            — page says submissions are closed
--   dead_domain        — DNS failure / connection refused
--   timeout            — request timed out
--   error              — unexpected error during check
--   unchecked          — default, never validated

-- Speed up the pipeline's priority query (NULL link_check_at = oldest priority)
CREATE INDEX IF NOT EXISTS idx_festivals_link_check_at
  ON festivals (link_check_at ASC NULLS FIRST)
  WHERE application_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_festivals_link_check_status
  ON festivals (link_check_status)
  WHERE application_url IS NOT NULL;

-- ── Audit log ──────────────────────────────────────────────────────────────────
-- One row per URL probe. Useful for debugging broken links and measuring
-- how effective recovery is over time.

CREATE TABLE IF NOT EXISTS application_link_checks (
  id                  BIGSERIAL    PRIMARY KEY,
  festival_id         BIGINT       NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  url                 TEXT         NOT NULL,
  url_slot            TEXT         NOT NULL DEFAULT 'primary',   -- 'primary' | 'secondary'
  status              TEXT         NOT NULL,
  http_status         INT,
  redirect_url        TEXT,        -- final URL after following redirects
  recovery_attempted  BOOLEAN      NOT NULL DEFAULT FALSE,
  recovery_url        TEXT,        -- URL found during recovery attempt
  recovery_source     TEXT,        -- 'festival_website' | 'filmfreeway' | 'url_guess'
  notes               TEXT,
  checked_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alc_festival_id
  ON application_link_checks (festival_id);

CREATE INDEX IF NOT EXISTS idx_alc_checked_at
  ON application_link_checks (checked_at DESC);

-- Service-role only — no end-user reads or writes
ALTER TABLE application_link_checks ENABLE ROW LEVEL SECURITY;
