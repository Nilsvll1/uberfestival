-- Phase A: Festival booking model segmentation
--
-- booking_model values:
--   open_call        — festival accepts public artist applications (confirmed)
--   invitation_only  — festival is curator-booked; no public application path exists
--   unknown          — not yet classified; may or may not accept applications
--
-- This column is the denominator for coverage metrics.
-- Premium coverage = open_call WITH path / (open_call + unknown)
-- invitation_only festivals are EXCLUDED from the coverage target.

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS booking_model TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE festivals
  DROP CONSTRAINT IF EXISTS chk_booking_model;

ALTER TABLE festivals
  ADD CONSTRAINT chk_booking_model
  CHECK (booking_model IN ('open_call', 'invitation_only', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_festivals_booking_model
  ON festivals (booking_model);
