-- Wipe the old (broken) sources and replace with verified-working ones.
-- All sources tested HTTP 200 + yield festival-related candidate links.

DELETE FROM scrape_sources;

INSERT INTO scrape_sources (name, url, is_active) VALUES
  -- High-yield general music industry blogs
  ('Musical America',              'https://www.musicalamerica.com/news/',                         true),
  ('Ditto Music Blog',             'https://dittomusic.com/en/blog/',                              true),
  ('iMusician Blog',               'https://imusician.pro/en/resources/blog/',                     true),
  ('CD Baby DIY Musician',         'https://diymusician.cdbaby.com/',                              true),
  ('Hypebot',                      'https://www.hypebot.com/hypebot/',                             true),
  ('Bandzoogle Blog',              'https://bandzoogle.com/blog/',                                 true),
  ('Music Week Talent',            'https://www.musicweek.com/talent/',                            true),

  -- Specific opportunity / open-call sources
  ('Americana Music Association',  'https://americanamusic.org/news',                             true),
  ('Help Musicians UK',            'https://helpmusicians.org.uk/news/',                          true),
  ('CaFE – Call for Entry',        'https://www.callforentry.org/',                               true),
  ('Jazz Corner',                  'https://www.jazzcorner.com/',                                 true),
  ('Songwriting Magazine UK',      'https://www.songwritingmagazine.co.uk/competitions/',         true),
  ('Sentric Music Blog',           'https://sentricmusic.com/blog/',                              true),

  -- Festival & showcase focused
  ('SongKick Festivals',           'https://www.songkick.com/festivals',                          true),
  ('BBC Introducing',              'https://www.bbc.co.uk/music/introducing',                     true),
  ('DIY Magazine Artists',         'https://diymag.com/artists/',                                 true),
  ('Indie Bible Blog',             'https://indiebible.com/blog/',                                true);
