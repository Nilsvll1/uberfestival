-- Phase 1: Curated festival page monitor
--
-- festival_pages: official call-for-entry URLs that the weekly pipeline
-- monitors for content changes. Only re-extracts when the page hash differs.
--
-- discovery_source: added to festivals + festival_staging to track whether
-- a record originated from RSS, the page monitor, or manual entry.

-- ── discovery_source column ───────────────────────────────────────────────────

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS discovery_source text;

ALTER TABLE festival_staging
  ADD COLUMN IF NOT EXISTS discovery_source text;

-- ── festival_pages table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS festival_pages (
  id               serial PRIMARY KEY,
  url              text NOT NULL,
  name             text NOT NULL,
  category         text,                          -- film, music, documentary, screenwriting, residency
  last_hash        text,                          -- SHA-256 of last fetched body (hex)
  last_checked_at  timestamptz,
  last_open_at     timestamptz,                   -- last time classifier accepted the page
  is_active        boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT festival_pages_url_unique UNIQUE (url),
  CONSTRAINT festival_pages_url_check CHECK (url ~* '^https?://')
);

-- Service-role only — no user-facing RLS needed.
ALTER TABLE festival_pages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_festival_pages_active
  ON festival_pages (is_active)
  WHERE is_active = true;

-- ── Seed: 60 major festival open-call / submission pages ──────────────────────

INSERT INTO festival_pages (name, url, category) VALUES

-- ── Film festivals ────────────────────────────────────────────────────────────
('Sundance Film Festival – Submissions',
 'https://www.sundance.org/festivals/sundance-film-festival/filmmaker-resources/submissions',
 'film'),

('SXSW Film Festival – Submit',
 'https://www.sxsw.com/film/submit-film/',
 'film'),

('Tribeca Film Festival – Submit',
 'https://tribecafilm.com/festival/submit',
 'film'),

('Hot Docs International Documentary Festival – Submissions',
 'https://hotdocs.ca/programmes/submissions/',
 'documentary'),

('IDFA – Submissions',
 'https://www.idfa.nl/en/info/submissions',
 'documentary'),

('Raindance Film Festival – Submit',
 'https://raindance.org/submit/',
 'film'),

('Palm Springs International Film Festival – Submit',
 'https://www.psfilmfest.org/filmmakers/submit',
 'film'),

('Glasgow Film Festival – Submit',
 'https://glasgowfilm.org/festival/submit',
 'film'),

('Fantasia International Film Festival – Submissions',
 'https://fantasiafestival.com/en/submissions',
 'film'),

('Overlook Film Festival – Submissions',
 'https://overlookfilmfest.com/submissions',
 'film'),

('Sitges International Film Festival – Submissions',
 'https://www.sitgesfilmfestival.com/en/professionals/submissions/',
 'film'),

('CPH:DOX – Submissions',
 'https://cphdox.dk/industry/submissions/',
 'documentary'),

('Sheffield Doc/Fest – Submit',
 'https://sheffdocfest.com/submit',
 'documentary'),

('AIDC (Australian International Documentary Conference) – Submit',
 'https://aidc.com.au/submit/',
 'documentary'),

('Encounters Short Film Festival – Submit',
 'https://encounters-festival.co.uk/submit/',
 'film'),

('Clermont-Ferrand Short Film Festival – Submissions',
 'https://www.clermont-filmfest.org/en/short-market/submit.html',
 'film'),

('IFFR (International Film Festival Rotterdam) – Filmmakers',
 'https://iffr.com/en/filmmakers',
 'film'),

('Locarno Film Festival – Submissions',
 'https://www.locarnofestival.ch/industry/industry-academy/submissions.html',
 'film'),

('Frameline LGBTQ+ Film Festival – Submit',
 'https://frameline.org/festival/submit-your-film/',
 'film'),

('Human Rights Watch Film Festival – Submit',
 'https://ff.hrw.org/submit-film',
 'documentary'),

('NewFest: New York''s LGBTQ+ Film Festival – Submit',
 'https://newfest.org/submit/',
 'film'),

('Outfest Los Angeles Film Festival – Submit',
 'https://outfest.org/submit/',
 'film'),

('AFI Fest – Submit',
 'https://www.afi.com/afifest/submit/',
 'film'),

('Montclair Film Festival – Submit',
 'https://montclairfilm.org/mff/submit/',
 'film'),

('NewFilmmakers NY – Submit',
 'https://www.newfilmmakersny.com/submit/',
 'film'),

-- ── Music festivals ───────────────────────────────────────────────────────────
('SXSW Music – Submit Artist',
 'https://www.sxsw.com/music/submit/',
 'music'),

('Glastonbury Emerging Talent Competition',
 'https://www.glastonburyfestivals.co.uk/information/emerging-talent-competition/',
 'music'),

('Eurosonic Noorderslag – Apply for ESNS',
 'https://www.eurosonic-noorderslag.nl/professionals/artists/apply-for-esns/',
 'music'),

('WOMEX – Call for Submissions',
 'https://www.womex.com/virtual/call_for_submissions',
 'music'),

('Reeperbahn Festival – Showcase Applications',
 'https://www.reeperbahnfestival.com/professionals/showcases/',
 'music'),

('Folk Alliance International – Showcases',
 'https://www.folk.org/programs/conferences/',
 'music'),

('CMW (Canadian Music Week) – Artist Submissions',
 'https://cmw.net/submissions/',
 'music'),

('BIME Festival – Artist Call',
 'https://bime.net/bime-live/',
 'music'),

('Focus Wales – Submit',
 'https://focuswales.com/submit/',
 'music'),

('Celtic Connections – New Voices',
 'https://www.celticconnections.com/Pages/New-Voices.aspx',
 'music'),

('Liverpool Sound City – Submit',
 'https://www.liverpoolsoundcity.co.uk/submit-your-act/',
 'music'),

('The Great Escape Festival – Submit',
 'https://greatescapefestival.com/submit/',
 'music'),

('Future Music Forum – Showcase Call',
 'https://futuremusicforum.com/showcase/',
 'music'),

('By:Larm – Submit',
 'https://bylarm.no/submit/',
 'music'),

('MENT Ljubljana – Showcase Applications',
 'https://www.ment.si/showcase-applications/',
 'music'),

-- ── Screenwriting competitions ─────────────────────────────────────────────────
('Austin Film Festival – Screenwriting Competition',
 'https://austinfilmfestival.com/submit/screenwriting/',
 'screenwriting'),

('PAGE International Screenwriting Awards – Enter',
 'https://www.pageawards.com/enter.php',
 'screenwriting'),

('Academy Nicholl Fellowships in Screenwriting',
 'https://www.oscars.org/nicholl',
 'screenwriting'),

('BlueCat Screenplay Competition',
 'https://www.bluecatscreenplay.com/',
 'screenwriting'),

('ScreenCraft – Competitions',
 'https://screencraft.org/competitions/',
 'screenwriting'),

('Script Pipeline – Screenwriting Competition',
 'https://scriptpipeline.com/enter/',
 'screenwriting'),

('Sundance Episodic Lab – Applications',
 'https://www.sundance.org/labs/episodic/',
 'screenwriting'),

('Final Draft Big Break Contest',
 'https://www.finaldraft.com/big-break/',
 'screenwriting'),

('Shore Scripts – Screenplay Contest',
 'https://www.shorescripts.com/screenplay-contest/',
 'screenwriting'),

-- ── Artist residencies linked to festivals ─────────────────────────────────────
('Yaddo – Apply',
 'https://www.yaddo.org/apply/',
 'residency'),

('MacDowell – Apply',
 'https://www.macdowell.org/apply',
 'residency'),

('Ucross Foundation – Residency Application',
 'https://www.ucross.org/residency-program/application-information/',
 'residency'),

('MASS MoCA – Artist Residents',
 'https://massmoca.org/artist-residents/',
 'residency'),

('Headlands Center for the Arts – Residency',
 'https://www.headlands.org/program/air/',
 'residency'),

('Montalvo Arts Center – Artist Residency',
 'https://montalvoarts.org/programs/sally_and_don_lucas_residency/',
 'residency'),

-- ── Mixed / funding calls ──────────────────────────────────────────────────────
('BFI Network – Open Calls',
 'https://network.bfi.org.uk/opportunities',
 'film'),

('Telefilm Canada – Programs',
 'https://telefilm.ca/en/programs',
 'film'),

('Screen Australia – Funding and Support',
 'https://www.screenaustralia.gov.au/funding-and-support',
 'film'),

('Creative Europe – Calls',
 'https://culture.ec.europa.eu/calls',
 'film'),

('Visions du Réel – Submissions',
 'https://www.visionsdureel.ch/en/films/submit-your-film/',
 'documentary')

ON CONFLICT (url) DO NOTHING;
