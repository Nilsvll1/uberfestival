import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase-server";
import { stripe } from "../../../../lib/stripe";

// Simple in-process rate limiter (per-user, per cold-start).
// On Vercel this resets on each function cold start, providing a best-effort
// guard against accidental multi-click spam (not a substitute for Redis-backed
// rate limiting at scale, but effective for early launch traffic volumes).
const checkoutAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT     = 5;      // max 5 checkout initiations per user per minute

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = checkoutAttempts.get(userId);
  if (!entry || entry.resetAt < now) {
    checkoutAttempts.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: 60 },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, is_premium")
    .eq("id", user.id)
    .single();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Already premium → redirect to Customer Portal to manage subscription
  if (profile?.is_premium && profile?.stripe_customer_id) {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl}/dashboard`,
    });
    return NextResponse.json({ url: portalSession.url });
  }

  // New subscription → Stripe Checkout
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: !profile?.stripe_customer_id ? user.email! : undefined,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout/cancel`,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
