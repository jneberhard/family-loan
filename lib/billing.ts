import type { BillingStatus, FamilyPlan, Family } from "@prisma/client";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe billing is not configured.");
  return new Stripe(secretKey);
}

export async function stripePriceId(plan: "MONTHLY" | "YEARLY") {
  const stripe = getStripe();
  const lookupKey = plan === "MONTHLY" ? "family_loan_ledger_monthly" : "family_loan_ledger_yearly";
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) return existing.data[0].id;

  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((item) => item.metadata.familyLoanLedger === "subscription");
  if (!product) {
    product = await stripe.products.create({ name: "Family Loan Ledger Family Subscription", metadata: { familyLoanLedger: "subscription" } });
  }
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: plan === "MONTHLY" ? 299 : 2999,
    recurring: { interval: plan === "MONTHLY" ? "month" : "year" },
    lookup_key: lookupKey,
  });
  return price.id;
}

export async function createFamilyCheckoutSession(
  family: Pick<Family, "id" | "stripeCustomerId">,
  owner: { email: string },
  plan: "MONTHLY" | "YEARLY",
) {
  const stripe = getStripe();
  const priceId = await stripePriceId(plan);
  let customerId = family.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create(
      { email: owner.email, metadata: { familyId: family.id } },
      { idempotencyKey: `family-ledger-customer-${family.id}` },
    );
    customerId = customer.id;
    await prisma.family.update({ where: { id: family.id }, data: { stripeCustomerId: customerId } });
  }
  const appUrl = getPublicAppUrl();
  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    customer: customerId,
    client_reference_id: family.id,
    metadata: { familyId: family.id, plan },
    subscription_data: { metadata: { familyId: family.id, plan } },
    success_url: `${appUrl}/pricing?checkout=success`,
    cancel_url: `${appUrl}/login?checkout=cancelled`,
  });
  await prisma.family.update({ where: { id: family.id }, data: { plan, billingStatus: "INCOMPLETE" } });
  return checkout.url;
}

export function hasPaidAccess(family: Pick<Family, "plan" | "billingStatus" | "subscriptionPeriodEnd">) {
  if (family.plan === "LEGACY") return true;
  if (family.plan !== "MONTHLY" && family.plan !== "YEARLY") return false;
  if (family.billingStatus !== "ACTIVE" && family.billingStatus !== "PAST_DUE") return false;
  return !family.subscriptionPeriodEnd || family.subscriptionPeriodEnd > new Date();
}

export function stripeBillingStatus(status: Stripe.Subscription.Status): BillingStatus {
  if (status === "active" || status === "trialing") return "ACTIVE";
  if (status === "past_due" || status === "unpaid") return "PAST_DUE";
  if (status === "canceled" || status === "incomplete_expired") return "CANCELED";
  return "INCOMPLETE";
}

export function getPublicAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://familyloanledger.com").replace(/\/$/, "");
}

export function familyPlanFromMetadata(value: string | undefined): FamilyPlan {
  return value === "YEARLY" ? "YEARLY" : "MONTHLY";
}

export async function isUserAllowedOnCurrentPlan(user: { id: string; role: string; familyId: string | null }, family: Pick<Family, "plan" | "billingStatus" | "subscriptionPeriodEnd">) {
  if (user.role === "SUPER_USER" || hasPaidAccess(family)) return true;
  if (!user.familyId) return false;
  if (user.role === "ADMIN") {
    const firstAdmin = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "ADMIN", deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    return firstAdmin?.id === user.id;
  }
  if (user.role === "CHILD") {
    const firstAccount = await prisma.loanAccount.findFirst({
      where: { familyId: user.familyId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { childUserId: true },
    });
    return firstAccount?.childUserId === user.id;
  }
  return false;
}

export async function isAccountVisibleOnCurrentPlan(familyId: string, accountId: string) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { plan: true, billingStatus: true, subscriptionPeriodEnd: true },
  });
  if (!family) return false;
  if (hasPaidAccess(family)) return true;
  const firstAccount = await prisma.loanAccount.findFirst({
    where: { familyId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return firstAccount?.id === accountId;
}
