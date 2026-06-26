-- application_status enum — 8 values representing the known state of
-- a festival's public application path. Derived from booking_model +
-- application_url + application_platform at migration time, then kept
-- in sync by the enrichment pipeline.
--
-- This column is SAFE to expose to client components (it's metadata,
-- not a URL). The actual application_url must never appear in RSC payloads.

CREATE TYPE festival_application_status AS ENUM (
  'verified_application',
  'email_submission',
  'filmfreeway',
  'festhome',
  'contact_form',
  'invitation_only',
  'seasonally_closed',
  'unknown'
);

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS application_status festival_application_status
  NOT NULL DEFAULT 'unknown';

-- Populate from existing booking_model + application_url + application_platform.
-- Priority order:
--   1. invitation_only (from booking_model) — unless they have a platform URL
--   2. filmfreeway / festhome (from URL pattern or application_platform)
--   3. verified_application (any other non-null application_url)
--   4. email_submission (application_email set)
--   5. unknown (fallback)
UPDATE festivals SET application_status = CASE
  WHEN booking_model = 'invitation_only'
    AND (
      application_url IS NULL
      OR application_url NOT SIMILAR TO
        '%(filmfreeway|festhome|submittable|jotform|typeform|docs\.google|eventival|wufoo|formstack|airtable)%'
    )
    THEN 'invitation_only'
  WHEN application_url LIKE '%filmfreeway.com%'
    OR application_platform = 'filmfreeway'
    THEN 'filmfreeway'
  WHEN application_url LIKE '%festhome.com%'
    OR application_platform = 'festhome'
    THEN 'festhome'
  WHEN application_url IS NOT NULL
    THEN 'verified_application'
  WHEN application_email IS NOT NULL
    THEN 'email_submission'
  ELSE 'unknown'
END::festival_application_status;

CREATE INDEX IF NOT EXISTS idx_festivals_application_status
  ON festivals (application_status);
