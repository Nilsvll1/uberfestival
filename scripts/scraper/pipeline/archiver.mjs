/**
 * Archiver — soft-deletes festival records that are no longer active.
 *
 * A festival is considered obsolete when:
 *   A. submission_deadline is more than 90 days in the past
 *      AND last_seen_at is more than 60 days ago (or null)
 *      → Deadline expired AND no RSS feed is still advertising it
 *
 *   B. No submission_deadline AND created more than 180 days ago
 *      AND last_seen_at is more than 90 days ago (or null)
 *      → Old record with no deadline, no recent sighting
 *
 * What we do:
 *   - Set is_archived = true
 *   - Set archived_at = NOW()
 *   - Set scrape_status = 'archived'
 *   - NEVER hard-delete (preserves history)
 *
 * Hidden from default search: the explore page queries WHERE is_archived IS NOT TRUE.
 */

/**
 * @param {import('@supabase/postgrest-js').PostgrestClient} db
 * @returns {Promise<number>} number of festivals archived
 */
export async function archiveStale(db) {
  const now       = new Date();
  const ago90days = new Date(now - 90 * 86400_000).toISOString().slice(0, 10);
  const ago60days = new Date(now - 60 * 86400_000).toISOString();
  const ago180d   = new Date(now - 180 * 86400_000).toISOString();
  const ago90dTs  = new Date(now - 90 * 86400_000).toISOString();

  let total = 0;

  // ── Condition A: expired deadline + not seen recently ─────────────────────
  {
    // First, find the IDs that match condition A
    const { data: toArchive, error: fetchErr } = await db
      .from("festivals")
      .select("id, festival_name, submission_deadline, last_seen_at")
      .eq("is_archived", false)
      .lt("submission_deadline", ago90days)
      .or(`last_seen_at.is.null,last_seen_at.lt.${ago60days}`);

    if (fetchErr) {
      console.error("[archiver] Condition-A fetch error:", fetchErr.message);
    } else if (toArchive?.length) {
      const ids = toArchive.map((f) => f.id);
      const { error: updateErr } = await db
        .from("festivals")
        .update({
          is_archived:  true,
          archived_at:  now.toISOString(),
          scrape_status: "archived",
        })
        .in("id", ids);

      if (updateErr) {
        console.error("[archiver] Condition-A update error:", updateErr.message);
      } else {
        total += ids.length;
        console.log(`[archiver] Archived ${ids.length} expired-deadline festivals`);
        for (const f of toArchive.slice(0, 5)) {
          console.log(`  · ${f.festival_name} (deadline: ${f.submission_deadline})`);
        }
        if (toArchive.length > 5) {
          console.log(`  · ...and ${toArchive.length - 5} more`);
        }
      }
    }
  }

  // ── Condition B: no deadline, old record, not seen recently ───────────────
  {
    const { data: toArchive, error: fetchErr } = await db
      .from("festivals")
      .select("id, festival_name, created_at")
      .eq("is_archived", false)
      .is("submission_deadline", null)
      .lt("created_at", ago180d)
      .or(`last_seen_at.is.null,last_seen_at.lt.${ago90dTs}`)
      .eq("is_verified", false); // Never auto-archive admin-verified records

    if (fetchErr) {
      console.error("[archiver] Condition-B fetch error:", fetchErr.message);
    } else if (toArchive?.length) {
      const ids = toArchive.map((f) => f.id);
      const { error: updateErr } = await db
        .from("festivals")
        .update({
          is_archived:   true,
          archived_at:   now.toISOString(),
          scrape_status: "archived",
        })
        .in("id", ids);

      if (updateErr) {
        console.error("[archiver] Condition-B update error:", updateErr.message);
      } else {
        total += ids.length;
        console.log(`[archiver] Archived ${ids.length} stale no-deadline festivals`);
      }
    }
  }

  return total;
}
