import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { origin } = new URL(req.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${origin}/login?redirectTo=/festival/${id}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", user.id)
    .single();

  if (!profile?.is_premium) {
    return NextResponse.redirect(`${origin}/#pricing`);
  }

  // Use service role so RLS doesn't interfere with the lookup.
  const { data: festival } = await supabaseAdmin
    .from("festivals")
    .select("application_url")
    .eq("id", id)
    .single();

  if (!festival?.application_url) {
    return NextResponse.redirect(`${origin}/festival/${id}`);
  }

  // Validate the stored URL before issuing the redirect.
  // Prevents open-redirect if a bad value ever reaches the DB.
  let applyUrl: URL;
  try {
    applyUrl = new URL(festival.application_url);
  } catch {
    return NextResponse.redirect(`${origin}/festival/${id}`);
  }
  if (!["http:", "https:"].includes(applyUrl.protocol)) {
    return NextResponse.redirect(`${origin}/festival/${id}`);
  }

  return NextResponse.redirect(festival.application_url);
}
