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
    .select("application_url, application_url_secondary, application_email, website, link_check_status")
    .eq("id", id)
    .single();

  // Cascade: URL primary → URL secondary → email → website → festival page
  const BROKEN = new Set(["not_found", "redirect_unrelated", "parked", "dead_domain", "timeout", "error"]);
  const primaryBroken = festival?.link_check_status && BROKEN.has(festival.link_check_status);

  let rawUrl: string | null = null;

  if (festival?.application_url && !primaryBroken) {
    rawUrl = festival.application_url;
  } else if (festival?.application_url_secondary) {
    rawUrl = festival.application_url_secondary;
  } else if (festival?.application_email) {
    rawUrl = `mailto:${festival.application_email}`;
  } else if (festival?.website) {
    rawUrl = festival.website;
  }

  if (!rawUrl) {
    return NextResponse.redirect(`${origin}/festival/${id}`);
  }

  // Validate before redirecting — prevents open-redirect if bad data reaches the DB.
  let applyUrl: URL;
  try {
    applyUrl = new URL(rawUrl);
  } catch {
    return NextResponse.redirect(`${origin}/festival/${id}`);
  }
  if (!["http:", "https:", "mailto:"].includes(applyUrl.protocol)) {
    return NextResponse.redirect(`${origin}/festival/${id}`);
  }

  // Log the click for recommendation signals (fire-and-forget, never blocks redirect).
  supabaseAdmin.from("application_history").upsert(
    { user_id: user.id, festival_id: Number(id), applied_at: new Date().toISOString() },
    { onConflict: "user_id,festival_id" }
  ).then(() => {});

  return NextResponse.redirect(applyUrl.href);
}
