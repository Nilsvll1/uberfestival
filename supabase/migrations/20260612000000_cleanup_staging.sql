-- Remove bad records that slipped into festival_staging before quality filters.
-- Targets: social media pages, music tool/SaaS pages, articles, and entries
-- missing the two required fields (festival_name, website).

DELETE FROM festival_staging
WHERE status = 'pending'
  AND (
    -- Missing required fields
    festival_name IS NULL
    OR website IS NULL

    -- Social media and streaming domains (never valid opportunities)
    OR source_url  ~* '\m(instagram|facebook|twitter|tiktok|youtube|spotify|soundcloud|bandcamp|deezer|tidal)\.com\M'
    OR application_url ~* '\m(instagram|facebook|twitter|tiktok|youtube|spotify|soundcloud)\.com\M'

    -- Article / blog / tool / SaaS URL paths
    OR source_url  ~* '/(blog|article|news/[a-z]|resource|guide|tools?|pricing|features|about-us|tag|category|author)/'
  );
