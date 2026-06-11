import { PostgrestClient } from "@supabase/postgrest-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

// Pure PostgREST client — no Auth, no Realtime, no WebSockets.
// Service-role key in Authorization header bypasses RLS.
export const db = new PostgrestClient(`${url}/rest/v1`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
});
