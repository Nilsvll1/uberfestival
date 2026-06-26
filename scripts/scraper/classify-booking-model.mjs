/**
 * Phase A — Festival Booking Model Classifier
 *
 * Segments every festival into one of three booking models:
 *
 *   open_call        — actively accepts public applications (confirmed by
 *                      having application_url or application_email)
 *   invitation_only  — curator-booked; no public application path will ever
 *                      exist (EDM/DJ-model genres, confirmed commercial names)
 *   unknown          — not yet classified; may accept applications seasonally
 *                      or via paths we haven't found yet
 *
 * Coverage metric uses: open_call / (open_call + unknown)
 * invitation_only is excluded from the denominator entirely.
 *
 * Usage:
 *   node --env-file=.env classify-booking-model.mjs
 *   node --env-file=.env classify-booking-model.mjs --dry-run
 *   node --env-file=.env classify-booking-model.mjs --report
 */

import { db } from "./lib/supabase.mjs";

const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REPORT  = args.includes("--report");

// ── Invitation-only genre categories ─────────────────────────────────────────
// DJ/producer-invite model. These genres have structural barriers to public
// applications: headliners are agents-only, support acts are label-connected.
const INVITATION_ONLY_GENRES = new Set([
  "Electronic Dance",
  "EDM",
  "Techno",
  "House",
  "Trance",
  "Psychedelic Trance",
  "Hard Dance",
  "Hardstyle",
  "Rave",
  "Drum & Bass",
  "Breakbeat",
  "Electro",
]);

// ── Invitation-only festival names ────────────────────────────────────────────
// Commercial mega-festivals confirmed to have no public application process.
// Verified manually — these are curator-programmed, agency-booked events.
const INVITATION_ONLY_NAMES = new Set([
  // North America — commercial mega
  "Coachella",
  "Lollapalooza",
  "Lollapalooza Chicago",
  "Bonnaroo",
  "Outside Lands",
  "Governors Ball",
  "BottleRock Napa Valley",
  "BottleRock Napa",
  "Austin City Limits",
  "Stagecoach",
  "New Orleans Jazz & Heritage Festival",
  "New Orleans Jazz Heritage Festival",
  "Newport Folk Festival",
  "Newport Jazz Festival",
  "Summerfest",
  "CMA Fest",
  "Beale Street Music Festival",
  "Voodoo Fest",
  "Osheaga",
  "Bluesfest Ottawa",

  // Europe — commercial mega
  "Glastonbury",
  "Reading Festival",
  "Leeds Festival",
  "Download Festival",
  "Download",
  "Creamfields",
  "Primavera Sound",
  "Rock Werchter",
  "Pinkpop",
  "Hellfest",
  "Wacken Open Air",
  "Wacken",
  "Graspop Metal Meeting",
  "Roskilde Festival",
  "Mad Cool Festival",
  "Bilbao BBK Live",
  "Benicassim Festival",
  "Arenal Sound",
  "Rock En Seine",
  "Main Square Festival",
  "Open'er Festival",
  "Off Festival",
  "Pohoda",
  "Rock am Ring",
  "Donauinselfest",
  "Pori Jazz",

  // Asia / Global
  "Fuji Rock Festival",
  "Summer Sonic",
  "Rock in Rio",
  "Lollapalooza Brazil",

  // Electronic mega
  "Tomorrowland",
  "Ultra Music Festival",
  "Ultra",
  "EDC Las Vegas",
  "Electric Daisy Carnival",
  "Defqon.1",
  "Awakenings Festival",
  "Awakenings",
  "Mysteryland",
  "UNTOLD Festival",
  "UNTOLD",
  "Ozora Festival",
  "Sea Dance Festival",
  "Sea Star Festival",
  "Ultra Europe",
  "Airbeat One",
  "Nature One",
  "Time Warp",
  "Transmission Festival",
  "ZoukOut",
  "Sunburn Festival",
  "Parookaville",
  "Liquicity",

  // Pop / mainstream
  "Summertime Ball",
  "BBC Proms",
  "V Festival",
  "Isle of Wight Festival",
  "T in the Park",
  "Love Rocks NYC",
  "Asia Song Festival",
  "Korea Sale Festa",
  "Seoul Jazz Festival",

  // Industry / exclusive
  "HARD",
  "Holy Ship!",
  "Groove Cruise",
  "Club Skirts Dinah Shore Weekend",
  "Output Festival",
  "Mayday",

  // Opera / classical — programmed by artistic directors, no public calls
  "Bayreuth Festival",
  "Glyndebourne Festival Opera",
  "Glyndebourne",
  "Salzburg Festival",
  "Edinburgh International Festival",
  "BBC Proms",
  "Verbier Festival",
  "Lucerne Festival",
  "Aix-en-Provence Festival",
  "Festival d'Aix-en-Provence",

  // Large commercial country / mainstream
  "CMA Music Festival",
  "Country Thunder",
  "Watershed Festival",
  "Faster Horses",
  "Boots in the Park",

  // Large commercial European
  "Roskilde",
  "Sziget Festival",
  "Sziget",
  "Rock am Ring",
  "Rock im Park",
  "Hurricane Festival",
  "Southside Festival",
  "Nova Rock",
  "Greenfield Festival",
  "Greenfield",
  "Baloise Session",
  "Montreux Jazz Festival",
  "North Sea Jazz Festival",

  // UK commercial
  "The Great Escape",
  "TRNSMT",
  "Victorious Festival",
  "Boardmasters",
  "Latitude Festival",
  "End of the Road Festival",

  // Large North American
  "Desert Trip",
  "Global Citizen Festival",
  "iHeartRadio Music Festival",
  "KAABOO",
  "Firefly Music Festival",
  "Hangout Music Festival",
  "Watershed",
  "Country Thunder USA",
]);

// ── Classifier ────────────────────────────────────────────────────────────────

const PLATFORM_URL_RE = /filmfreeway\.com|festhome\.com|submittable\.com|jotform\.com|typeform\.com|docs\.google\.com|eventival\.com|wufoo\.com|formstack\.com|airtable\.com/i;

function classify(festival) {
  const name = (festival.festival_name ?? "").trim();
  const genre = festival.category ?? "";

  // Name-based invitation-only check runs FIRST — prevents bad application_url data
  // (e.g. French text, stale news URLs) from wrongly overriding a known invite-only festival.
  // Exception: if the URL is a recognised platform link (FilmFreeway showcase etc.), allow open_call.
  const isNameInviteOnly = INVITATION_ONLY_NAMES.has(name) ||
    [...INVITATION_ONLY_NAMES].some((n) => name.toLowerCase().startsWith(n.toLowerCase()));
  const isGenreInviteOnly = INVITATION_ONLY_GENRES.has(genre);

  if (isNameInviteOnly || isGenreInviteOnly) {
    // If the festival has a recognised platform link, treat as open_call (they have a showcase stage)
    const hasPlatformUrl = festival.application_url && PLATFORM_URL_RE.test(festival.application_url);
    if (!hasPlatformUrl) return "invitation_only";
  }

  // Confirmed open call — has an actionable application path
  if (festival.application_url || festival.application_email) {
    return "open_call";
  }

  return "unknown";
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(64)}`);
console.log(`  Phase A — Booking Model Classifier`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
console.log(`${"═".repeat(64)}\n`);

const { data: festivals, error } = await db
  .from("festivals")
  .select("id, festival_name, category, application_url, application_email, booking_model")
  .eq("is_archived", false)
  .order("id");

if (error) { console.error("[FATAL]", error.message); process.exit(1); }

const changes = { open_call: [], invitation_only: [], unknown: [] };
let unchanged = 0;

for (const f of festivals) {
  const model = classify(f);
  if (model === f.booking_model) { unchanged++; continue; }
  changes[model].push(f);
}

console.log(`  Total festivals:     ${festivals.length}`);
console.log(`  Unchanged:           ${unchanged}`);
console.log(`  → open_call:         ${changes.open_call.length}`);
console.log(`  → invitation_only:   ${changes.invitation_only.length}`);
console.log(`  → unknown:           ${changes.unknown.length}\n`);

if (DRY_RUN) {
  console.log("  [dry-run] invitation_only sample:");
  changes.invitation_only.slice(0, 30).forEach((f) =>
    console.log(`    [${f.id}] ${f.festival_name} (${f.category})`));
  console.log("\n  [dry-run] No DB writes.");
  process.exit(0);
}

// Batch-update each model in groups of 50
async function batchUpdate(records, model) {
  if (!records.length) return;
  const ids = records.map((f) => f.id);
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const { error } = await db
      .from("festivals")
      .update({ booking_model: model })
      .in("id", chunk);
    if (error) console.warn(`  [warn] batch update failed: ${error.message}`);
  }
  console.log(`  Updated ${records.length} → ${model}`);
}

await batchUpdate(changes.open_call, "open_call");
await batchUpdate(changes.invitation_only, "invitation_only");
await batchUpdate(changes.unknown, "unknown");

// ── Coverage report ───────────────────────────────────────────────────────────

if (REPORT || !DRY_RUN) {
  const [openCallRes, openCallPathRes, inviteOnlyRes, unknownRes] = await Promise.all([
    db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "open_call").eq("is_archived", false),
    db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "open_call").eq("is_archived", false).or("application_url.not.is.null,application_email.not.is.null"),
    db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "invitation_only").eq("is_archived", false),
    db.from("festivals").select("id", { count: "exact", head: true }).eq("booking_model", "unknown").eq("is_archived", false),
  ]);

  const openCall    = openCallRes.count ?? 0;
  const withPath    = openCallPathRes.count ?? 0;
  const inviteOnly  = inviteOnlyRes.count ?? 0;
  const unknown     = unknownRes.count ?? 0;
  const denominator = openCall + unknown;
  const coverage    = denominator > 0 ? ((withPath / denominator) * 100).toFixed(1) : 0;

  console.log(`\n${"═".repeat(64)}`);
  console.log(`  COVERAGE REPORT`);
  console.log(`${"═".repeat(64)}`);
  console.log(`  open_call (verified):     ${openCall.toString().padStart(5)}`);
  console.log(`  open_call WITH path:      ${withPath.toString().padStart(5)}`);
  console.log(`  invitation_only (excl.):  ${inviteOnly.toString().padStart(5)}`);
  console.log(`  unknown:                  ${unknown.toString().padStart(5)}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Effective denominator:    ${denominator.toString().padStart(5)}`);
  console.log(`  Coverage (path/denom):    ${coverage.toString().padStart(5)}%`);
  console.log(`  Target:                    80.0%`);
  console.log(`  Gap:                      ${Math.max(0, 80 - parseFloat(coverage)).toFixed(1)}% (${Math.max(0, Math.ceil(denominator * 0.8) - withPath)} more paths needed)`);
  console.log(`${"═".repeat(64)}\n`);
}
