/**
 * Application Link Validator — standalone CLI.
 *
 * Sweeps existing application_url values for every live festival, probes each
 * via HTTP, classifies the result, and writes back link_check_status.
 * Broken URLs trigger automatic recovery (website crawl + FilmFreeway lookup).
 *
 * Usage:
 *   node --env-file=.env validate-apply-links.mjs
 *   node --env-file=.env validate-apply-links.mjs --dry-run
 *   node --env-file=.env validate-apply-links.mjs --limit=50
 *   node --env-file=.env validate-apply-links.mjs --status=not_found
 *   node --env-file=.env validate-apply-links.mjs --id=42
 *
 * Options:
 *   --dry-run        Preview without writing to DB
 *   --limit=N        Check at most N festivals (default: all)
 *   --status=STATUS  Re-check only festivals with this link_check_status
 *   --id=N           Check a single festival by ID
 */

import { db } from "./lib/supabase.mjs";
import { validateApplicationLinks } from "./pipeline/link-validator.mjs";

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes("--dry-run");
const limitArg    = parseInt(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0", 10);
const statusArg   = args.find((a) => a.startsWith("--status="))?.split("=")[1] ?? null;
const idArg       = parseInt(args.find((a) => a.startsWith("--id="))?.split("=")[1] ?? "0", 10);

console.log(`\n${"═".repeat(64)}`);
console.log(`  UberFestival — Application Link Validator`);
console.log(`  ${new Date().toISOString()}${DRY_RUN ? "  [DRY RUN]" : ""}`);
if (limitArg) console.log(`  Limit: ${limitArg}`);
if (statusArg) console.log(`  Status filter: ${statusArg}`);
if (idArg) console.log(`  Festival ID: ${idArg}`);
console.log(`${"═".repeat(64)}\n`);

try {
  const { checked, broken, recovered } = await validateApplicationLinks(
    db,
    null,   // no pipeline reporter in standalone mode
    null,   // no runId
    DRY_RUN,
    {
      limit: limitArg || 2000,  // full sweep by default
      statusFilter: statusArg,
      festivalId: idArg || null,
    },
  );

  const reliabilityPct = checked > 0 ? ((checked - broken) / checked * 100).toFixed(1) : "n/a";
  console.log(`\n${"═".repeat(64)}`);
  console.log(`  Checked:    ${checked}`);
  console.log(`  Working:    ${checked - broken}`);
  console.log(`  Broken:     ${broken}`);
  console.log(`  Recovered:  ${recovered}`);
  console.log(`  Reliability: ${reliabilityPct}%`);
  console.log(`${"═".repeat(64)}\n`);

  process.exit(0);
} catch (err) {
  console.error("\n[FATAL]", err.message);
  process.exit(1);
}
