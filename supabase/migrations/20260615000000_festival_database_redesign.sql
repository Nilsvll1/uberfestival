-- ─── Festival database redesign ─────────────────────────────────────────────
--
-- Objective change: scraper now builds a database of real music festivals
-- worldwide, not music industry opportunities (grants, awards, residencies).
--
-- Changes:
--   1. Add latitude / longitude to festival_staging
--   2. Add source_type to scrape_sources
--   3. Replace all existing scrape_sources with real festival directories
--   4. Add latitude / longitude to festivals table

-- ── 1. festival_staging: add coordinates ─────────────────────────────────────

ALTER TABLE festival_staging
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- ── 2. festivals table: add coordinates ──────────────────────────────────────

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS latitude  double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- ── 3. scrape_sources: add source_type column ────────────────────────────────

ALTER TABLE scrape_sources
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'directory';
  -- 'directory'      — festival website directory (follow links to festival pages)
  -- 'wikipedia_list' — Wikipedia "List of music festivals in X" page

-- ── 4. Replace all sources with real festival directories ────────────────────

DELETE FROM scrape_sources;

INSERT INTO scrape_sources (name, url, source_type, is_active) VALUES

  -- ── Wikipedia list pages ─────────────────────────────────────────────────
  -- These pages contain wikitables with festival name, location, and genre.
  -- The scraper parses the tables directly (no link-following needed).

  ('Wikipedia: UK music festivals',          'https://en.wikipedia.org/wiki/List_of_music_festivals_in_the_United_Kingdom', 'wikipedia_list', true),
  ('Wikipedia: US music festivals',          'https://en.wikipedia.org/wiki/List_of_music_festivals_in_the_United_States',  'wikipedia_list', true),
  ('Wikipedia: France music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_France',             'wikipedia_list', true),
  ('Wikipedia: Germany music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Germany',            'wikipedia_list', true),
  ('Wikipedia: Netherlands festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_the_Netherlands',    'wikipedia_list', true),
  ('Wikipedia: Belgium music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Belgium',            'wikipedia_list', true),
  ('Wikipedia: Sweden music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Sweden',             'wikipedia_list', true),
  ('Wikipedia: Norway music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Norway',             'wikipedia_list', true),
  ('Wikipedia: Denmark music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Denmark',            'wikipedia_list', true),
  ('Wikipedia: Finland music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Finland',            'wikipedia_list', true),
  ('Wikipedia: Switzerland festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Switzerland',        'wikipedia_list', true),
  ('Wikipedia: Spain music festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Spain',              'wikipedia_list', true),
  ('Wikipedia: Portugal music festivals',    'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Portugal',           'wikipedia_list', true),
  ('Wikipedia: Italy music festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Italy',              'wikipedia_list', true),
  ('Wikipedia: Croatia music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Croatia',            'wikipedia_list', true),
  ('Wikipedia: Poland music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Poland',             'wikipedia_list', true),
  ('Wikipedia: Ireland music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Ireland',            'wikipedia_list', true),
  ('Wikipedia: Hungary music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Hungary',            'wikipedia_list', true),
  ('Wikipedia: Romania music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Romania',            'wikipedia_list', true),
  ('Wikipedia: Serbia music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Serbia',             'wikipedia_list', true),
  ('Wikipedia: Austria music festivals',     'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Austria',            'wikipedia_list', true),
  ('Wikipedia: Greece music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Greece',             'wikipedia_list', true),
  ('Wikipedia: Canada music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Canada',             'wikipedia_list', true),
  ('Wikipedia: Mexico music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Mexico',             'wikipedia_list', true),
  ('Wikipedia: Brazil music festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Brazil',             'wikipedia_list', true),
  ('Wikipedia: Argentina music festivals',   'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Argentina',          'wikipedia_list', true),
  ('Wikipedia: Japan music festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Japan',              'wikipedia_list', true),
  ('Wikipedia: South Korea festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_South_Korea',        'wikipedia_list', true),
  ('Wikipedia: India music festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_India',              'wikipedia_list', true),
  ('Wikipedia: Australia music festivals',   'https://en.wikipedia.org/wiki/List_of_music_festivals_in_Australia',          'wikipedia_list', true),
  ('Wikipedia: South Africa festivals',      'https://en.wikipedia.org/wiki/List_of_music_festivals_in_South_Africa',       'wikipedia_list', true),
  ('Wikipedia: New Zealand festivals',       'https://en.wikipedia.org/wiki/List_of_music_festivals_in_New_Zealand',        'wikipedia_list', true),
  ('Wikipedia: Jazz festivals (global)',     'https://en.wikipedia.org/wiki/List_of_jazz_festivals',                        'wikipedia_list', true),
  ('Wikipedia: Electronic music festivals',  'https://en.wikipedia.org/wiki/List_of_electronic_music_festivals',            'wikipedia_list', true),
  ('Wikipedia: Rock music festivals',        'https://en.wikipedia.org/wiki/List_of_rock_music_festivals',                  'wikipedia_list', true),
  ('Wikipedia: Folk music festivals',        'https://en.wikipedia.org/wiki/List_of_folk_music_festivals',                  'wikipedia_list', true),
  ('Wikipedia: Classical music festivals',   'https://en.wikipedia.org/wiki/List_of_classical_music_festivals',             'wikipedia_list', true),

  -- ── Festival directories ─────────────────────────────────────────────────
  -- Listing pages from known festival databases. The scraper follows links
  -- to individual festival pages and extracts structured data.

  -- North America
  ('MusicFestivalWizard — All Festivals',    'https://www.musicfestivalwizard.com/all-festivals/',              'directory', true),
  ('JamBase — Festival Listings',            'https://www.jambase.com/festivals',                               'directory', true),

  -- Europe
  ('eFestivals — UK Directory',              'https://www.efestivals.co.uk/festivals/',                          'directory', true),
  ('Skiddle — UK Festivals',                 'https://www.skiddle.com/whats-on/festivals/',                      'directory', true),
  ('Resident Advisor — Festivals',           'https://ra.co/events/festivals',                                   'directory', true),
  ('Festicket — Global Festivals',           'https://www.festicket.com/festivals/',                             'directory', true),

  -- Australia
  ('The Music — Australian Festivals',       'https://themusic.com.au/features/all/festivals/',                  'directory', true),

  -- Jazz (global)
  ('Jazz Festival World',                    'https://www.jazzfestivalworld.com/',                               'directory', true),

  -- World music & world beat (global)
  ('WorldMusic.co.uk — Festivals',           'https://www.worldmusic.co.uk/festivals/',                          'directory', true),

  -- Electronic / dance (global)
  ('DJ Mag — Festival Guide',                'https://djmag.com/events/festivals',                               'directory', true),

  -- Top 300 global
  ('Fest300 — Top Festivals Worldwide',      'https://fest300.com/',                                             'directory', true);
