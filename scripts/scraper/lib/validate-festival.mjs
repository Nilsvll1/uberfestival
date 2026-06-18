/**
 * Validates that a record represents a real music festival event.
 *
 * Hard-rejects anything that looks like: grants, awards, competitions,
 * residencies, conferences, articles, news, FAQ pages, or resource listings.
 *
 * Returns: { valid: boolean, reason: string }
 */

const REJECT_NAME_RE = [
  /\b(grant|bursary|stipend)\b/i,
  /\b(award|prize|honour|honor)\b/i,
  /\b(competition|contest|battle of the bands)\b/i,
  /\b(fellowship|scholarship|mentorship|mentoring)\b/i,
  /\b(residency|artist.in.residence)\b/i,
  /\b(open call|call for (entries|submissions|artists|proposals|applications))\b/i,
  /\b(apply (now|today|here)|application (form|portal|deadline)|applications? open)\b/i,
  /\b(conference|summit|symposium|forum|panel|roundtable)\b/i,
  /\b(workshop|masterclass|seminar|lecture|tutorial)\b/i,
  /\b(funding|invest|finance|support programme)\b/i,
  /\b(press release|announcement|news update|blog post)\b/i,
  /^(resources?|directory|listing|about us?|contact us?|faq|help|home)\b/i,
  /^(latest|current|upcoming) (opportunities|events|news)\b/i,
  /^how to /i,
  /^top \d+ /i,
  /^(the )?(complete|ultimate|definitive) guide/i,
];

export function validateFestival(record) {
  const name = (record.festival_name ?? "").trim();

  if (!name || name.length < 3) return { valid: false, reason: "empty name" };
  if (name.length > 200) return { valid: false, reason: "name too long (>200 chars)" };

  for (const re of REJECT_NAME_RE) {
    if (re.test(name)) {
      return { valid: false, reason: `non-festival keyword in name: "${name}"` };
    }
  }

  // Must have at least website OR geographic information to be useful
  const hasWebsite = !!(record.official_website || record.website);
  const hasGeo = !!(record.city || record.country);
  if (!hasWebsite && !hasGeo) {
    return { valid: false, reason: "no website and no geographic information" };
  }

  return { valid: true, reason: "ok" };
}
