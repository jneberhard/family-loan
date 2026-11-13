import { NextResponse } from "next/server";
import Stripe from "stripe";
import { familyPlanFromMetadata, getStripe, stripeBillingStatus } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

async function syncSubscription(subscription: Stripe.Subscription) {
  const familyId = subscription.metadata.familyId;
  if (!familyId) return;
  const existing = await prisma.family.findUnique({ where: { id: familyId }, select: { plan: true, approvalStatus: true } });
  if (!existing) return;
  await prisma.family.update({
    where: { id: familyId },
    data: {
      plan: subscription.metadata.plan === "MONTHLY" || subscription.metadata.plan === "YEARLY"
        ? familyPlanFromMetadata(subscription.metadata.plan)
        : existing.plan,
      billingStatus: stripeBillingStatus(subscription.status),
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      subscriptionPeriodEnd: new Date((subscription.items.data[0]?.current_period_end ?? subscription.billing_cycle_anchor) * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      ...(existing.approvalStatus === "PENDING" && (subscription.status === "active" || subscription.status === "trialing")
        ? { approvalStatus: "APPROVED" as const }
        : {}),
    },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const checkout = event.data.object as Stripe.Checkout.Session;
      if (typeof checkout.subscription === "string") {
        const subscription = await getStripe().subscriptions.retrieve(checkout.subscription);
        await syncSubscription(subscription);
      }
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.paused" ||
      event.type === "customer.subscription.resumed"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Unable to sync subscription state." }, { status: 500 });
  }
}
