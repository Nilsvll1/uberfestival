/**
 * Reporter — manages pipeline_runs and pipeline_run_events DB records.
 *
 * Usage pattern:
 *   const reporter = createReporter(db);
 *   const runId = await reporter.start();
 *   await reporter.log(runId, 'info', 'feed_fetch', 'Fetched 12 items', { feed: 'Jazz Feed' });
 *   await reporter.complete(runId, stats);
 *   await reporter.fail(runId, error);
 */

/**
 * @param {import('@supabase/postgrest-js').PostgrestClient} db
 */
export function createReporter(db) {
  // In-memory buffer: flush in batches to reduce DB round-trips
  const buffer = [];
  let flushTimer = null;

  async function flush(runId) {
    if (!buffer.length) return;
    const batch = buffer.splice(0, buffer.length);
    const rows = batch.map((e) => ({ ...e, run_id: runId }));
    const { error } = await db.from("pipeline_run_events").insert(rows);
    if (error) {
      // Don't throw — logging failure should never crash the pipeline
      console.error("[reporter] Failed to flush event batch:", error.message);
    }
  }

  return {
    /**
     * Creates a new pipeline_runs row and returns its ID.
     */
    async start() {
      const { data, error } = await db
        .from("pipeline_runs")
        .insert({ status: "running", started_at: new Date().toISOString() })
        .select("id")
        .single();

      if (error) throw new Error(`[reporter] Cannot create run row: ${error.message}`);
      console.log(`[pipeline] Run #${data.id} started`);
      return data.id;
    },

    /**
     * Buffers a log event (flushed periodically or on complete/fail).
     */
    log(runId, level, eventType, message, data = null) {
      const entry = {
        level,
        event_type: eventType,
        message,
        created_at: new Date().toISOString(),
        data: data ? JSON.stringify(data) : null,
      };
      buffer.push(entry);

      // Console output for CI log visibility
      const prefix = level === "error" ? "✖" : level === "warn" ? "⚠" : "·";
      console.log(`  ${prefix} [${eventType}] ${message}`);

      // Auto-flush every 50 events to avoid huge batches at the end
      if (buffer.length >= 50) {
        flush(runId).catch(console.error);
      }
    },

    /**
     * Marks the run as completed and stores the final stats.
     */
    async complete(runId, stats) {
      await flush(runId);
      clearTimeout(flushTimer);

      const { error } = await db.from("pipeline_runs").update({
        status:              "completed",
        completed_at:        new Date().toISOString(),
        feeds_processed:     stats.feedsProcessed,
        items_found:         stats.itemsFound,
        festivals_created:   stats.festivalsCreated,
        festivals_updated:   stats.festivalsUpdated,
        festivals_archived:  stats.festivalsArchived,
        errors_count:        stats.errorsCount,
        duration_ms:         stats.durationMs,
        summary:             JSON.stringify(stats),
      }).eq("id", runId);

      if (error) console.error("[reporter] Failed to complete run:", error.message);

      console.log(`\n[pipeline] Run #${runId} COMPLETE`);
      console.log(`  Feeds processed : ${stats.feedsProcessed}`);
      console.log(`  Items found     : ${stats.itemsFound}`);
      console.log(`  Festivals created: ${stats.festivalsCreated}`);
      console.log(`  Festivals updated: ${stats.festivalsUpdated}`);
      console.log(`  Festivals archived: ${stats.festivalsArchived}`);
      console.log(`  Errors          : ${stats.errorsCount}`);
      console.log(`  Duration        : ${(stats.durationMs / 1000).toFixed(1)}s`);
    },

    /**
     * Marks the run as failed with an error message.
     */
    async fail(runId, err) {
      await flush(runId);
      const { error } = await db.from("pipeline_runs").update({
        status:        "failed",
        completed_at:  new Date().toISOString(),
        error_message: err?.message ?? String(err),
      }).eq("id", runId);

      if (error) console.error("[reporter] Failed to mark run as failed:", error.message);
      console.error(`[pipeline] Run #${runId} FAILED:`, err?.message ?? err);
    },
  };
}
