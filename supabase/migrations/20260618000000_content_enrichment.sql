-- Content enrichment: festival images and descriptions
--
-- hero_image_url: the festival's own og:image, scraped from their website.
--   When populated, replaces the genre-pool Unsplash fallback.
--   NULL means the scraper hasn't run yet or the site had no og:image.
--
-- description: human-readable summary answering what/where/genre/why notable.
--   Sourced from og:description, Wikipedia, or a structured template.
--   The column already exists in the Festival TypeScript type; this adds it
--   to the actual database table.

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT;
