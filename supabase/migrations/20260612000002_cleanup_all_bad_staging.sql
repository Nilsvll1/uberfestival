-- Aggressive cleanup of festival_staging.
-- Removes ALL pending records that cannot be valid festival/opportunity entries.
-- Targets: person-name profile pages, login pages, articles, records from old
-- music-blog sources, and any record with no geographic data at all.

DELETE FROM festival_staging
WHERE status = 'pending'
AND (

  -- ── Missing required fields ──────────────────────────────────────────────────
  festival_name IS NULL
  OR festival_name = ''
  OR website    IS NULL

  -- ── From known bad source domains (old music blogs / platforms) ───────────
  -- These were the 17 sources replaced in migration 20260612000001.
  OR source_url ~* '\y(jazzcorner|songkick|musicalamerica|dittomusic|hypebot|bandzoogle|musicweek|sentricmusic|diymag|indiebible|imusician|diymusician)\.'
  OR source_url LIKE '%callforentry.org%'
  OR source_url LIKE '%bbc.co.uk/music/introducing%'
  OR source_url LIKE '%helpmusicians.org.uk/news%'
  OR source_url LIKE '%americanamusic.org/news%'

  -- ── Social media / streaming sources ────────────────────────────────────────
  OR source_url ~* '\y(instagram|facebook|twitter|tiktok|youtube|spotify|soundcloud|bandcamp|deezer|tidal)\.com\y'

  -- ── Profile / account / login source pages ───────────────────────────────────
  OR source_url ~* '/(musician|performer|artist|profile|user|account|login|sign-?in|signup|register)s?(/[^/]|$)'
  OR source_url ~* '/(my-account|my-profile|dashboard)(/|$)'

  -- ── Article / blog / tool source pages ──────────────────────────────────────
  OR source_url ~* '/(blog|article|news/[a-z]|resource|guide|tools?|pricing|features|tag|category|author)/'

  -- ── Person name pattern in festival_name ────────────────────────────────────
  -- Matches "Chris Walker", "Dave Shank", "Antonio Hart", "Featured Articles" etc.
  -- Exception: titles containing a music/event context word are kept.
  OR (
    festival_name ~ '^[A-Z][a-z]+''* [A-Z][a-z]+''*$'
    AND lower(festival_name) !~* '\y(festival|music|jazz|folk|rock|pop|blues|soul|indie|electronic|classical|world|reggae|punk|metal|ambient|sound|arts|band|song|open|showcase|award|competition|residency|grant|ensemble|orchestra|quartet|trio|society|foundation|institute|center|centre|academy|project|collective|studio|north|south|east|west|global|international|national|community|exchange|talent|emerging|summer|winter|spring|annual)\y'
  )

  -- ── Known bad title patterns ─────────────────────────────────────────────────
  OR lower(festival_name) ~* '^(featured |stories of |login|sign in|sign up|my account|my profile|error |page not found|loading|404|navigation|introducing |home$|songkick|bbc introducing|call for entry platform)'

  -- ── No geographic data ───────────────────────────────────────────────────────
  -- Entries with no country AND no city cannot be placed on the map and
  -- are almost always profile pages, articles, or generic resources.
  OR (country IS NULL AND city IS NULL)

);
