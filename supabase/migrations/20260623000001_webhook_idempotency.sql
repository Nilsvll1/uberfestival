-- Stripe webhook idempotency table.
--
-- Before processing each event the handler checks if stripe_event_id already
-- exists. If it does, it returns 200 immediately without re-processing.
-- After successful processing it inserts the ID so future retries are skipped.
--
-- Stripe retries webhooks for up to 3 days, so events older than 7 days are
-- safe to delete. A partial index makes that cleanup query cheap.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  stripe_event_id  text        PRIMARY KEY,
  event_type       text        NOT NULL,
  processed_at     timestamptz NOT NULL DEFAULT now()
);

-- Useful for periodic cleanup: DELETE ... WHERE processed_at < now() - interval '7 days'
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at
  ON processed_webhook_events (processed_at);

-- Service-role only — no user access needed.
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
