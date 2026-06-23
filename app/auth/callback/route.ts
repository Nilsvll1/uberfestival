import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase-server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Reject absolute URLs and protocol-relative paths — open redirect prevention.
  const safeNext =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  // Exchange failed — send back to login with an error param.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
