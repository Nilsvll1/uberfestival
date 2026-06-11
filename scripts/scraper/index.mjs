/**
 * Entry point for the festival scraper.
 *
 * Usage:
 *   node index.mjs               # run both phases
 *   node index.mjs --mode=update  # only refresh existing festivals
 *   node index.mjs --mode=discover # only discover new ones
 *
 * Required environment variables:
 *   SUPABASE_URL              — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS)
 */

import { updateExisting } from "./scrapers/update-existing.mjs";
import { discoverFromSources } from "./scrapers/discover-sources.mjs";

const mode = process.argv
  .find((a) => a.startsWith("--mode="))
  ?.replace("--mode=", "") ?? "all";

console.log(`\n=== UberFestival Scraper — mode: ${mode} ===`);
console.log(`Started at ${new Date().toISOString()}\n`);

try {
  if (mode === "all" || mode === "update") {
    console.log("── Phase 1: updating existing festivals ──");
    await updateExisting();
    console.log();
  }

  if (mode === "all" || mode === "discover") {
    console.log("── Phase 2: discovering new festivals ──");
    await discoverFromSources();
    console.log();
  }

  console.log(`=== Done at ${new Date().toISOString()} ===\n`);
  process.exit(0);
} catch (err) {
  console.error("Fatal error:", err);
  process.exit(1);
}
