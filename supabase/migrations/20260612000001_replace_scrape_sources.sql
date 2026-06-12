-- Replace all low-value music blog sources with 14 curated high-quality sources.
-- Every source verified HTTP 200, produces HTML-accessible candidate links, and
-- was dry-run tested against the quality gate (classify-page.mjs ≥55 threshold).
--
-- Source audit summary:
--   Dropped: 17 music industry blogs / SaaS tools / social aggregators
--   Added:   14 sources targeting real festival applications, artist residencies,
--            open calls, music grants, competitions, and showcase opportunities.

DELETE FROM scrape_sources;

INSERT INTO scrape_sources (name, url, is_active) VALUES

  -- ── Artist residency open calls (largest single source) ───────────────────
  -- ~120 individual open-call pages, global coverage, ~60 % quality-gate pass rate.
  -- Individual pages use "open call", "artist in residence", "apply now" etc.

  ('Artist Communities Alliance – Open Calls',
   'https://www.artistcommunities.org/directory/open-calls',
   true),

  -- ── Music export & national showcase programs ─────────────────────────────
  -- MXD publishes Nordic artist opportunities with 80 % quality-gate pass rate.
  -- Pages contain "open call", "open for submissions", "apply now" etc.

  ('Music Export Denmark – Funding Opportunities',
   'https://musicexportdenmark.dk/funding-opportunities/',
   true),

  -- ── National arts funding bodies ──────────────────────────────────────────

  -- Arts Council of Northern Ireland: funding programmes for individual artists.
  ('Arts Council of Northern Ireland',
   'https://www.artscouncil-ni.org/funding/',
   true),

  -- SMIA award-submissions listing scores 100 in the quality gate and links
  -- to individual award websites (SAY Award, Sound of Young Scotland, etc.).
  ('SMIA – Award Submissions',
   'https://www.smia.org.uk/opportunity-type/award-submissions/',
   true),

  -- Sound and Music: UK new-music opportunities aggregator updated regularly.
  ('Sound and Music (UK)',
   'https://soundandmusic.org/opportunities/',
   true),

  -- PRS Foundation open grants for UK music creators (always-open fund).
  ('PRS Foundation – Open Fund',
   'https://prsfoundation.com/funding-support/funding-for-music-creators/open-fund/',
   true),

  -- PRS Foundation early-career grants (separate programme, separate links).
  ('PRS Foundation – Early Career',
   'https://prsfoundation.com/funding-support/funding-for-music-creators/early-career/',
   true),

  -- Youth Music UK: distributes £10 M/yr to music projects; opportunity pages.
  ('Youth Music UK',
   'https://youthmusic.org.uk/funding',
   true),

  -- ── Major festival & showcase applications ────────────────────────────────

  -- SXSW: applications page links to festival/conference submission portals.
  ('SXSW Music Festival Applications',
   'https://www.sxsw.com/applications/music/',
   true),

  -- AmericanaFest: home page links to /submissions/ (showcase submissions, 75+).
  ('AmericanaFest Showcase Submissions',
   'https://americanamusic.org/',
   true),

  -- The Great Escape: UK emerging-artist festival with new-band submissions.
  ('The Great Escape Festival',
   'https://greatescapefestival.com/',
   true),

  -- ── Music competitions & awards ───────────────────────────────────────────

  -- Songwriting Magazine UK: competitions listing with multiple entries per page.
  ('Songwriting Magazine UK – Competitions',
   'https://www.songwritingmagazine.co.uk/competitions/',
   true),

  -- International Songwriting Competition: major global competition entry page.
  ('International Songwriting Competition',
   'https://www.songwritingcompetition.com/',
   true),

  -- Independent Music Awards: annual IMA competition.
  ('Independent Music Awards',
   'https://www.independentmusicawards.com/',
   true);
