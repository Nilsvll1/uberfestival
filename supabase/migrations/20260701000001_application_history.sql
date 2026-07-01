-- Tracks when a logged-in user clicks the Apply link.
-- Used as a signal in the recommendation engine:
--   "people also applied to" and personalised-feed ranking.
CREATE TABLE application_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  festival_id INTEGER NOT NULL REFERENCES festivals(id) ON DELETE CASCADE,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, festival_id)
);

CREATE INDEX application_history_user_idx  ON application_history (user_id);
CREATE INDEX application_history_festival_idx ON application_history (festival_id);

ALTER TABLE application_history ENABLE ROW LEVEL SECURITY;

-- Users can read and insert their own rows; no updates/deletes (append-only).
CREATE POLICY "user_select_own" ON application_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_insert_own" ON application_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
