-- Stripe subscription fields on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status      TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS is_premium               BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_until            TIMESTAMPTZ;

-- Index for webhook lookups by customer / subscription
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_idx
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_stripe_subscription_idx
  ON profiles (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
