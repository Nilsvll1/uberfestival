-- Application email path
-- Stores a direct booking/application email as a fallback when no URL exists.
-- Treated as a first-class application path: Premium users get a mailto: redirect.

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS application_email TEXT;

CREATE INDEX IF NOT EXISTS idx_festivals_application_email
  ON festivals (application_email)
  WHERE application_email IS NOT NULL;
