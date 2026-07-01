-- ─── Notification log ─────────────────────────────────────────────────────────
-- Append-only record of every notification email sent.
-- Used for deduplication across all notification types.

CREATE TABLE notification_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL,
  type        TEXT    NOT NULL CHECK (type IN ('reopening_alert', 'weekly_digest', 'deadline_reminder')),
  festival_id INTEGER REFERENCES festivals(id) ON DELETE SET NULL,
  context     JSONB,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary lookup: "did we already send this to this user recently?"
CREATE INDEX notification_log_lookup
  ON notification_log (user_id, type, festival_id, sent_at DESC);

-- ─── Add email_reopening_alerts to notification_prefs ─────────────────────────

-- Update the column default so new users get the field.
ALTER TABLE profiles
  ALTER COLUMN notification_prefs
  SET DEFAULT '{"email_deadlines": true, "email_new_opportunities": false, "email_product_updates": true, "email_reopening_alerts": true}'::jsonb;

-- Backfill existing rows that don't have the field yet.
UPDATE profiles
   SET notification_prefs = notification_prefs || '{"email_reopening_alerts": true}'::jsonb
 WHERE notification_prefs->>'email_reopening_alerts' IS NULL;
