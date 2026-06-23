// DEPRECATED — do not import this file.
//
// This legacy singleton was created before @supabase/ssr was adopted.
// It does not share the cookie-based session used by the server client and
// will cause session desynchronisation bugs if used alongside supabase-server.ts.
//
// Use instead:
//   Server Components / Route Handlers: lib/supabase-server.ts → createClient()
//   Client Components:                  lib/supabase-browser.ts → createClient()
//   Service-role operations:            lib/supabase-admin.ts   → supabaseAdmin

export {};
