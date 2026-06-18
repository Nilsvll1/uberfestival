/**
 * Genre normalization for festival_staging.
 *
 * Runs two passes:
 *   1. Null out values that are not genres (CSS artifacts, country names,
 *      US state names, Wikipedia nav labels, noise strings).
 *   2. Canonicalize case and spelling variants (rock→Rock, jazz→Jazz, etc.).
 *
 * Usage:
 *   node --env-file=.env normalize-genres.mjs            # apply
 *   node --env-file=.env normalize-genres.mjs --dry-run  # preview
 *   node --env-file=.env normalize-genres.mjs --report   # distribution only
 */

import { db } from "./lib/supabase.mjs";

const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REPORT  = args.includes("--report");

// ── Canonical genre map (lowercase key → canonical label, or null to erase) ──

const CANON = {
  // ── Rock ──────────────────────────────────────────────────────────────────
  "rock":                       "Rock",
  "rock music":                 "Rock",
  "rock festival":              "Rock",
  "hard rock":                  "Hard Rock",
  "alternative rock":           "Alternative Rock",
  "alternative":                "Alternative",
  "alternative music":          "Alternative",
  "indie rock":                 "Indie Rock",
  "indie":                      "Indie",
  "indie music":                "Indie",
  "indie pop":                  "Indie Pop",
  "indie dance":                "Indie Dance",
  "indie/rock/hip hop":         "Various",
  "folk rock":                  "Folk Rock",
  "pop rock":                   "Pop Rock",
  "punk rock":                  "Punk Rock",
  "punk":                       "Punk",
  "hardcore punk":              "Hardcore Punk",
  "post-hardcore":              "Post-Hardcore",
  "mainly punk":                "Punk",
  "rockabilly":                 "Rock",
  "rock and roll":              "Rock",
  "stoner rock":                "Rock",
  "acoustic rock":              "Rock",
  "nu metal":                   "Metal",
  "metalcore":                  "Metal",
  "viking metal":               "Metal",
  "gothic rock":                "Gothic Rock",
  "new wave":                   "New Wave",
  "progressive metal":          "Progressive Metal",
  "death metal":                "Death Metal",
  "black metal":                "Metal",
  "heavy metal":                "Heavy Metal",
  "heavy metal festival":       "Heavy Metal",
  "metal music":                "Metal",
  "extreme metal":              "Metal",
  "metal":                      "Metal",
  "hardcore":                   "Hardcore",
  "latin rock":                 "Latin Rock",
  "blues rock":                 "Blues Rock",
  "folk festival (alternative": "Folk",
  "classic rock":               "Rock",
  "rock & folk":                "Rock",

  // ── Electronic ────────────────────────────────────────────────────────────
  "electronic":                   "Electronic",
  "electronic dance":             "Electronic Dance",
  "electronic dance music":       "Electronic Dance",
  "electronic dance sic":         "Electronic Dance",   // typo in source
  "electronic music":             "Electronic",
  "electronic-music festival":    "Electronic",
  "electronic music festival":    "Electronic",
  "electronic dance festivals":   "Electronic Dance",
  "electronic dance music festival": "Electronic Dance",
  "dance and electronic":         "Electronic Dance",
  "electronica":                  "Electronic",
  "electro":                      "Electro",
  "edm":                          "EDM",
  "edm (main)":                   "EDM",
  "bass music (edm)":             "EDM",
  "techno":                       "Techno",
  "hard techno":                  "Techno",
  "house":                        "House",
  "trance":                       "Trance",
  "hard dance":                   "Hard Dance",
  "dance":                        "Dance",
  "dance / electronic / hip hop / rap": "Electronic Dance",
  "drum and bass":                "Drum & Bass",
  "dubstep":                      "Dubstep",
  "hardstyle":                    "Hardstyle",
  "rawstyle":                     "Hardstyle",
  "psychedelic trance":           "Psychedelic Trance",
  "progressive house":            "House",
  "electroacoustic":              "Electroacoustic",
  "ambient":                      "Ambient",
  "breakbeat":                    "Breakbeat",
  "breakbeat hardcore":           "Breakbeat Hardcore",
  "chiptune":                     "Electronic",
  "synth":                        "Electronic",
  "electro swing":                "Electro Swing",
  "musique actuelle":             "Experimental",

  // ── Jazz ──────────────────────────────────────────────────────────────────
  "jazz":                         "Jazz",
  "jazz music":                   "Jazz",
  "jazz festival":                "Jazz",
  "jazz festival":                "Jazz",
  "australian jazz":              "Jazz",
  "jazz improvised music crossover world": "Jazz",
  "bebop":                        "Jazz",
  "gypsy jazz":                   "Jazz",
  "klezmer":                      "Jazz",

  // ── Classical ─────────────────────────────────────────────────────────────
  "classical":                    "Classical",
  "classical music":              "Classical",
  "classical music festival":     "Classical",
  "classical and opera":          "Classical & Opera",
  "classical; chamber music; musical theatre": "Classical",
  "20th-century classical":       "Classical",
  "mostly classical":             "Classical",
  "contemporary classical music festival": "Classical",
  "early":                        "Early Music",
  "early music festival":         "Early Music",
  "baroque":                      "Baroque",
  "opera":                        "Opera",
  "opera festival":               "Opera",
  "chamber":                      "Chamber Music",
  "chamber music":                "Chamber Music",
  "mostly chamber":               "Chamber Music",
  "festival of contemporary chamber": "Classical",
  "choral":                       "Choral",
  "choir":                        "Choral",
  "a cappella":                   "Choral",
  "choral ensemble":              "Choral",
  "choral festival":              "Choral",
  "classical guitar":             "Classical",
  "carnatic":                     "Classical",
  "hindustani classical":         "Classical",
  "indian classical music festival": "Classical",
  "indian classical music (hindustani": "Classical",
  "indian classical":             "Classical",
  "south asian classical":        "Classical",
  "rare piano":                   "Classical",
  "counterpoint":                 "Classical",
  "woodwind instrument":          "Classical",
  "wind":                         "Classical",
  "concert band":                 "Classical",
  "hafabra":                      "Classical",
  "orchestra":                    "Classical",
  "klapa":                        "Choral",

  // ── Pop ───────────────────────────────────────────────────────────────────
  "pop":                          "Pop",
  "popular music":                "Pop",
  "k-pop":                        "K-Pop",
  "korean pop":                   "K-Pop",
  "j-pop":                        "J-Pop",
  "c-pop":                        "C-Pop",
  "indiepop":                     "Indie Pop",
  "avant-pop":                    "Pop",

  // ── Folk / Country / Roots ───────────────────────────────────────────────
  "folk":                         "Folk",
  "folk music":                   "Folk",
  "folk festival":                "Folk",
  "american folk":                "Folk",
  "folk song":                    "Folk",
  "folk music festival":          "Folk",
  "bluegrass":                    "Bluegrass",
  "bluegrass festival":           "Bluegrass",
  "americana":                    "Americana",
  "country":                      "Country",
  "country music festival":       "Country",
  "alternative country":          "Country",
  "celtic":                       "Celtic",
  "celtic music festival":        "Celtic",
  "irish folk":                   "Folk",
  "fado":                         "Fado",
  "flamenco":                     "Flamenco",
  "chanson":                      "Folk",
  "breton dance":                 "Folk",
  "galician traditional":         "Folk",
  "québécois":                    "Folk",
  "dansband":                     "Folk",
  "zydeco":                       "Folk",
  "bard song":                    "Folk",
  "kleinkunst":                   "Folk",
  "medieval folk rock":           "Folk",
  "medieval reenactment":         "Folk",
  "first nations music":          "Folk",
  "traditional":                  "Folk",
  "traditional fiddle":           "Folk",
  "gnawa":                        "World Music",
  "gnawa":                        "World Music",
  "vallenato":                    "World Music",
  "raï":                          "World Music",
  "pizzica":                      "World Music",
  "african":                      "World Music",
  "latin":                        "Latin",
  "cuban":                        "World Music",
  "congolese rumbadombolo": "World Music",

  // ── Hip-Hop ───────────────────────────────────────────────────────────────
  "hip hop":                      "Hip-Hop",
  "hip-hop":                      "Hip-Hop",
  "hip hop culture festival":     "Hip-Hop",
  "primarily hip hop":            "Hip-Hop",
  "chh":                          "Hip-Hop",
  "ccm":                          "Hip-Hop",

  // ── Blues / Soul / Funk / R&B ─────────────────────────────────────────────
  "blues":                        "Blues",
  "blues festival":               "Blues",
  "soul":                         "Soul",
  "r&b":                          "R&B",
  "rhythm and blues":             "R&B",
  "funk":                         "Funk",
  "reggae":                       "Reggae",
  "reggae dub":                   "Reggae",
  "gospel":                       "Gospel",
  "christian":                    "Christian",
  "christian rock":               "Christian",
  "christian music festival":     "Christian",
  "christian pop":                "Christian",
  "jam band":                     "Jam Band",
  "jam bands":                    "Jam Band",
  "jam":                          "Jam Band",
  "surf":                         "Rock",
  "ska":                          "Ska",
  "soul and r&b":                 "R&B",

  // ── World / Experimental ──────────────────────────────────────────────────
  "world":                        "World Music",
  "world music":                  "World Music",
  "ethnic":                       "World Music",
  "experimental":                 "Experimental",
  "experimental music":           "Experimental",
  "experimental music festival":  "Experimental",
  "experimental electronic music and art": "Experimental",
  "neue musik":                   "Experimental",
  "neue deutsche härte":          "Rock",
  "acoustic":                     "Acoustic",

  // ── Various / Multi-genre ─────────────────────────────────────────────────
  "cross-genre":                  "Cross-Genre",
  "various":                      "Various",
  "mixed":                        "Various",
  "varied":                       "Various",
  "variety":                      "Various",
  "all":                          "Various",
  "all genres":                   "Various",
  "various genres":               "Various",
  "all genres of original & contemporary": "Various",
  "multi":                        "Various",
  "multigenre":                   "Various",
  "multiple":                     "Various",
  "different":                    "Various",
  "eclectic":                     "Various",
  "diverse genres":               "Various",
  "varied: rock":                 "Various",
  "various: rock":                "Various",
  "various – rock":               "Various",
  "various (music":               "Various",
  "various: music & arts":        "Various",
  "indie/dance":                  "Various",
  "contemporary":                 "Various",
  "independent":                  "Various",
  "musique indépendante":         "Independent",
  "popular musicelectronic":      "Various",
  "multidisciplinary":            "Various",
  "multicultural":                "Various",
  "lifestyle festival":           "Various",
  "transformational festival":    "Various",
  "electronic dance sic":         "Electronic Dance",

  // ── Null out — clearly not genres ─────────────────────────────────────────
  // CSS artifacts
  ".mw-parser-output .hlist dl":    null,
  ".mw-parser-output .plainlist ol": null,
  // Wikipedia nav labels
  "p–t": null, "a–e": null, "m–o": null, "f-l": null, "v–z": null, "u": null,
  // Category labels
  "lists by type": null,
  "festivals": null,
  "music festival": null,
  "music festivals": null,
  "music festival (r&b": null,
  "music festival and industry conference": null,
  "music": null,
  "music program": null,
  "performing arts festival": null,
  "arts festival": null,
  "major arts": null,
  "arts": null,
  "culture": null,
  "cultural": null,
  "festival": null,
  "festival of contemporary chamber": "Classical",
  "film festival": null,
  "film festivals in argentina": null,
  "music festivals in argentina": null,
  "music festivals in brazil": null,
  "song contest": null,
  "singing competition": null,
  "music competition": null,
  "music competitionreality television": null,
  "talent show": null,
  "showcase festival": null,
  "touring festivals": null,
  "australian": null,
  "music television": null,
  "children's television": null,
  "television score": null,
  "conference": null,
  "competition": null,
  "benefit concert": null,
  "live": null,
  "basic": null,
  "any": null,
  "mostly": null,
  "mixed": "Various",
  "nerd": null,
  "new australian": null,
  "public event": null,
  "military tattoo": null,
  "pow wow": null,
  "church": null,
  "video game": null,
  "video games": null,
  "marching event": null,
  "youth": null,
  "family festival": null,
  "family music festival": null,
  "free family friendly christian festival": "Christian",
  "philosophy": null,
  "art": null,
  "theater": null,
  "theatre": null,
  "street theatre": null,
  "musical theater": null,
  "music literature theatre film art": null,
  "music / arts": null,
  "music and dance festival at various locations featuring folk": "Folk",
  "music showcase": null,
  "drum": null,
  "showcase": null,
  "retro music": null,
  "romance music": null,
  "hip hop culture festival": "Hip-Hop",
  "wizard rock": "Rock",
  "tribute act festivals": "Rock",
  "teen friendly": null,
  "fairs": null,
  // Country names (all → null)
  "peru": null, "colombia": null, "norway": null, "brazil": null,
  "argentina": null, "bolivia": null, "chile": null, "philippines": null,
  "finland": null, "spain": null, "france": null, "indonesia": null,
  "ireland": null, "nepal": null, "austria": null, "singapore": null,
  "germany": null, "lithuania": null, "malta": null, "portugal": null,
  "guyana": null, "china": null, "nigeria": null, "latvia": null,
  "iceland": null, "north macedonia": null, "slovenia": null, "sweden": null,
  "mexico": null, "turkey": null, "south africa": null, "taiwan": null,
  "belgium": null, "denmark": null, "russia": null, "poland": null,
  "serbia": null, "asia": null, "europe": null, "uruguay": null,
  "french guiana": null, "falkland islands": null, "thailand": null,
  "vietnam": null, "bulgaria": null, "haiti": null, "uganda": null,
  "egypt": null, "india": null, "tunisia": null, "lebanon": null, "cyprus": null,
  "czech republic": null, "hungary": null, "luxembourg": null,
  "croatia": null, "greece": null, "switzerland": null,
  "dominican republic": null, "slovakia": null,
  // US states
  "california": null, "illinois": null, "new york": null, "missouri": null,
  "iowa": null, "maryland": null, "colorado": null, "connecticut": null,
  "hawaii": null, "minnesota": null, "michigan": null, "texas": null,
  "tennessee": null, "ohio": null, "washington": null, "wisconsin": null,
  "alabama": null, "louisiana": null, "maine": null, "utah": null,
  "virginia": null, "arizona": null, "florida": null, "delaware": null,
  "kansas": null, "kentucky": null, "indiana": null, "oregon": null,
  "pennsylvania": null, "mississippi": null, "new jersey": null,
  "south carolina": null, "vermont": null, "georgia": null,
  "north carolina": null,
};

// Catch-all for concatenated multi-genre strings and long garbage
const GARBAGE_RE = /^\.|^lists\b|^festivals?\s*$|mw-parser|^\w–\w$|^[a-z]–[a-z]$|country\s*music.*bluegrass|trance.*house.*dance|funkHip|electrorock|\d{4}\s*(to|–)/i;

function normalizeGenre(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Hard garbage check first
  if (GARBAGE_RE.test(trimmed)) return null;

  // Lookup in canonical map (case-insensitive)
  const key = trimmed.toLowerCase();
  if (key in CANON) return CANON[key];

  // If it's very long or contains multiple genres concatenated, null it
  if (trimmed.length > 60) return null;

  // Otherwise keep but title-case it (capitalize first letter of each word
  // for short, single-word or hyphenated values not in the map)
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// ── Pagination helper ─────────────────────────────────────────────────────────

async function fetchAll(buildQuery) {
  const PAGE = 1000;
  let all = [], offset = 0;
  while (true) {
    const { data } = await buildQuery().range(offset, offset + PAGE - 1);
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    offset += 1000;
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`  Genre Normalization${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`  ${new Date().toISOString()}`);
console.log(`${"═".repeat(60)}\n`);

const allRecords = await fetchAll(() =>
  db.from("festival_staging").select("id, genre")
);
console.log(`Loaded ${allRecords.length} records\n`);

// Build patch list
const patches = [];
let nulledOut = 0, normalized = 0, unchanged = 0;

for (const r of allRecords) {
  const fixed = normalizeGenre(r.genre);
  if (fixed === r.genre) { unchanged++; continue; }
  patches.push({ id: r.id, old: r.genre, genre: fixed });
  if (fixed === null) nulledOut++;
  else normalized++;
}

console.log(`Changes needed: ${patches.length}`);
console.log(`  Nulled out (non-genre):  ${nulledOut}`);
console.log(`  Normalized (case/spell): ${normalized}`);
console.log(`  Unchanged:               ${unchanged}\n`);

// Show sample of nulled-out values
const nullSample = patches.filter(p => p.genre === null).slice(0, 30);
console.log("Sample nulled out:");
for (const p of nullSample) {
  console.log(`  [${p.id}] "${p.old}" → NULL`);
}
if (nulledOut > 30) console.log(`  … and ${nulledOut - 30} more`);

// Show sample of normalizations
const normSample = patches.filter(p => p.genre !== null).slice(0, 20);
console.log("\nSample normalizations:");
for (const p of normSample) {
  console.log(`  "${p.old}" → "${p.genre}"`);
}

if (REPORT || DRY_RUN) {
  // Compute projected distribution without writing
  const projected = {};
  const idToPatch = Object.fromEntries(patches.map(p => [p.id, p.genre]));
  for (const r of allRecords) {
    const g = (r.id in idToPatch ? idToPatch[r.id] : r.genre) ?? "__null__";
    projected[g] = (projected[g] ?? 0) + 1;
  }
  printDistribution(projected, "PROJECTED GENRE DISTRIBUTION");

  if (!DRY_RUN) process.exit(0);
}

if (DRY_RUN) {
  console.log("\nDry run — no writes performed.");
  process.exit(0);
}

// ── Apply patches ─────────────────────────────────────────────────────────────

console.log(`\nApplying ${patches.length} patches…`);
const CHUNK = 50;
let done = 0, errors = 0;

for (let i = 0; i < patches.length; i += CHUNK) {
  const chunk = patches.slice(i, i + CHUNK);
  await Promise.allSettled(chunk.map(async p => {
    const { error } = await db.from("festival_staging")
      .update({ genre: p.genre })
      .eq("id", p.id);
    if (error) { errors++; }
    else { done++; }
  }));
}

console.log(`✓ ${done} records updated, ${errors} errors\n`);

// ── Final distribution from DB ────────────────────────────────────────────────

const fresh = await fetchAll(() =>
  db.from("festival_staging").select("genre")
);
const finalDist = {};
for (const r of fresh) {
  const g = r.genre ?? "__null__";
  finalDist[g] = (finalDist[g] ?? 0) + 1;
}
printDistribution(finalDist, "FINAL GENRE DISTRIBUTION");

// Also show how many records now qualify as score=100
const { count: score100 } = await db.from("festival_staging")
  .select("*", { count: "exact", head: true })
  .not("website",  "is", null)
  .not("country",  "is", null)
  .not("latitude", "is", null)
  .not("city",     "is", null)
  .not("genre",    "is", null)
  .eq("status",    "pending");

console.log(`Score=100 records (publish-ready): ${score100}\n`);

// ── Helper ────────────────────────────────────────────────────────────────────

function printDistribution(dist, label) {
  const sorted = Object.entries(dist)
    .filter(([k]) => k !== "__null__")
    .sort((a, b) => b[1] - a[1]);
  const nullCount = dist["__null__"] ?? 0;
  const total = Object.values(dist).reduce((a, b) => a + b, 0);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"═".repeat(60)}`);
  console.log(`  ${"NULL".padEnd(30)} ${String(nullCount).padStart(5)}  (${Math.round(nullCount/total*100)}%)`);
  console.log(`  ${"─".repeat(50)}`);
  for (const [g, n] of sorted.slice(0, 40)) {
    console.log(`  ${g.slice(0,30).padEnd(30)} ${String(n).padStart(5)}  (${Math.round(n/total*100)}%)`);
  }
  if (sorted.length > 40) console.log(`  … and ${sorted.length - 40} more distinct values`);
  console.log();
}
