import { PostgrestClient } from "@supabase/postgrest-js";

const rawUrl = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

// Normalize: strip trailing slashes and any /rest/v1 that was accidentally
// included in the secret. We always append it ourselves so the path is never
// doubled (//rest/v1/...) regardless of how the secret was set.
const baseUrl = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "");
const restUrl = `${baseUrl}/rest/v1`;

console.log(`[supabase] REST endpoint: ${restUrl}`);

// Pure PostgREST client — no Auth, no Realtime, no WebSockets.
// Service-role key in Authorization header bypasses RLS.
export const db = new PostgrestClient(restUrl, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
});
