import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

// In Stripe API 2026-05-27.dahlia, current_period_end moved from
// the Subscription to each SubscriptionItem.
function getPeriodEnd(subscription: Stripe.Subscription): string | null {
  const end = subscription.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items"],
        });
        const premiumUntil = getPeriodEnd(subscription);

        await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: subscription.status,
              is_premium: subscription.status === "active",
              premium_until: premiumUntil,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const isActive = ["active", "trialing"].includes(subscription.status);
        const premiumUntil = getPeriodEnd(subscription);

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            is_premium: isActive,
            premium_until: isActive ? premiumUntil : null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "canceled",
            is_premium: false,
            premium_until: null,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "invoice.payment_succeeded": {
        // In Stripe API 2026-05-27.dahlia, subscription is at invoice.parent.subscription_details.subscription
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          invoice.parent?.subscription_details?.subscription as string | undefined;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items"],
        });
        const premiumUntil = getPeriodEnd(subscription);

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "active",
            is_premium: true,
            premium_until: premiumUntil,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          invoice.parent?.subscription_details?.subscription as string | undefined;
        if (!subscriptionId) break;

        await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "past_due",
            is_premium: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);
        break;
      }
    }
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
