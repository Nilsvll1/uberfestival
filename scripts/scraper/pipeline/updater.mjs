/**
 * Updater — creates new festivals and updates existing ones.
 *
 * Rules:
 *   CREATE: confidence >= HIGH_CONFIDENCE_THRESHOLD → insert directly into
 *           festivals table (marked is_verified = false, scrape_status = ok).
 *           confidence < threshold → send to festival_staging for admin review.
 *
 *   UPDATE: only overwrite a field if the new value is clearly better:
 *           - submission_deadline: update only if new date is ≥ existing
 *             (never shorten a deadline that's already stored)
 *           - application_url: update if we don't have one yet
 *           - description: update if new is longer
 *           - website: update if we don't have one yet
 *           - last_seen_at: always update
 */

// Geocoding is done upstream in Phase B (enricher.mjs).
// By the time createFestival() is called, lat/lng are already set (or null).

const HIGH_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Creates a new festival record.
 *
 * Returns 'created_live' if inserted into festivals,
 *         'created_staging' if queued for admin review.
 *
 * @param {object} record         — already geocoded by Phase B
 * @param {number} confidence     — final score from Phase C
 * @param {import('@supabase/postgrest-js').PostgrestClient} db
 * @returns {Promise<'created_live'|'created_staging'|'skipped'>}
 */
export async function createFestival(record, confidence, db) {
  // Strip enrichment metadata fields before sending to DB
  const { _geocoded: _g, _url_live: _u, ...clean } = record;

  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    // High-confidence → publish directly
    const { error } = await db.from("festivals").insert({
      ...clean,
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    });

    if (error) {
      if (error.code === "23505") return "skipped"; // unique violation, already exists
      throw new Error(`DB insert failed: ${error.message}`);
    }
    return "created_live";
  } else {
    // Low-confidence → staging queue for admin review
    const { error } = await db.from("festival_staging").insert({
      festival_name:       clean.festival_name,
      country:             clean.country ?? null,
      city:                clean.city ?? null,
      genre:               clean.category ?? null,
      application_url:     clean.application_url ?? null,
      submission_deadline: clean.submission_deadline ?? null,
      festival_start_date: clean.festival_start_date ?? null,
      festival_end_date:   clean.festival_end_date ?? null,
      website:             clean.website ?? null,
      source_url:          clean.source_url ?? null,
      raw_text:            clean.description ?? null,
      status:              "pending",
      created_at:          new Date().toISOString(),
    });

    if (error && error.code !== "23505") {
      throw new Error(`Staging insert failed: ${error.message}`);
    }
    return "created_staging";
  }
}

/**
 * Updates specific fields on an existing festival record.
 * Only overwrites when the new value is clearly better.
 *
 * @param {number} existingId
 * @param {object} existing — current DB row (subset with relevant fields)
 * @param {object} incoming — newly extracted record
 * @param {import('@supabase/postgrest-js').PostgrestClient} db
 * @returns {Promise<boolean>} true if any fields were updated
 */
export async function updateFestival(existingId, existing, incoming, db) {
  const patch = {};

  // submission_deadline: take the later (more recent) deadline
  if (incoming.submission_deadline) {
    const existingDl = existing.submission_deadline ?? "";
    if (!existingDl || incoming.submission_deadline > existingDl) {
      patch.submission_deadline = incoming.submission_deadline;
    }
  }

  // application_url: fill in if missing
  if (incoming.application_url && !existing.application_url) {
    patch.application_url = incoming.application_url;
  }

  // website: fill in if missing
  if (incoming.website && !existing.website) {
    patch.website = incoming.website;
  }

  // description: use new one if substantially longer
  if (
    incoming.description &&
    (incoming.description.length > (existing.description?.length ?? 0) + 50)
  ) {
    patch.description = incoming.description;
  }

  // category: fill in if missing
  if (incoming.category && !existing.category) {
    patch.category = incoming.category;
  }

  // Always bump last_seen_at to prove the opportunity is still active
  patch.last_seen_at = new Date().toISOString();
  patch.updated_at   = new Date().toISOString();

  const changed = Object.keys(patch).filter((k) => k !== "last_seen_at" && k !== "updated_at");

  const { error } = await db.from("festivals").update(patch).eq("id", existingId);
  if (error) throw new Error(`Update failed for festival ${existingId}: ${error.message}`);

  return changed.length > 0;
}
