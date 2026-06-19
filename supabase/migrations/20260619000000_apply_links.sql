-- Apply links enrichment schema
--
-- application_platform: where the application is hosted
--   'official'       — festival's own website
--   'filmfreeway'    — FilmFreeway.com
--   'festhome'       — Festhome.com
--   'submittable'    — Submittable.com
--   'eventival'      — Eventival.com
--   'jotform'        — JotForm embed
--   'typeform'       — Typeform embed
--   'google_forms'   — Google Forms
--   'other'          — any other verified third-party
--
-- application_status: state of the call at time of last check
--   'open'    — currently accepting submissions
--   'closed'  — explicitly closed / deadline passed
--   'unknown' — page exists but status unclear
--
-- application_source: URL or label of where the link was discovered
--   e.g. the festival homepage URL, "filmfreeway_search", etc.
--
-- application_verified_at: timestamp of last successful verification
--
-- application_confidence: 0.00–1.00
--   >= 0.80  high   — dedicated apply page or known platform, name confirmed
--   0.50–0.79 medium — URL pattern match, unconfirmed content
--   <  0.50  low    — indirect signal (contact page, booking inquiry)

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS application_platform   TEXT,
  ADD COLUMN IF NOT EXISTS application_status     TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS application_source     TEXT,
  ADD COLUMN IF NOT EXISTS application_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS application_confidence NUMERIC(3,2);
