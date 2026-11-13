import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasPaidAccess } from "@/lib/billing";
import { PricingPlans } from "@/components/pricing-plans";

export const metadata = {
  title: "Plans and pricing",
  description: "Choose a free family loan ledger or full family access with a monthly or yearly subscription.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const [{ checkout }, session] = await Promise.all([searchParams, getSession()]);
  const family = session?.familyId
    ? await prisma.family.findUnique({
        where: { id: session.familyId },
        select: { plan: true, billingStatus: true, subscriptionPeriodEnd: true, stripeCustomerId: true },
      })
    : null;
  let isBillingOwner = false;
  if (session?.role === "ADMIN" && session.familyId) {
    const originalAdmin = await prisma.user.findFirst({
      where: { familyId: session.familyId, role: "ADMIN", deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    isBillingOwner = originalAdmin?.id === session.userId;
  }

  return (
    <main className="pricing-page">
      <nav className="landing-nav container">
        <Link href="/" className="brand"><span>Family Loan Ledger</span></Link>
        <div className="landing-nav-actions">
          <Link href="/" className="button button-ghost">Home</Link>
          {session ? <Link href={session.role === "SUPER_USER" ? "/super-admin" : "/dashboard"} className="button button-primary">Dashboard</Link> : <Link href="/login" className="button button-primary">Sign in</Link>}
        </div>
      </nav>
      <PricingPlans
        checkoutState={checkout ?? ""}
        signedIn={Boolean(session)}
        canManageBilling={isBillingOwner}
        isPaid={Boolean(family && hasPaidAccess(family))}
        hasCustomer={Boolean(family?.stripeCustomerId)}
        plan={family?.plan ?? "FREE"}
        billingStatus={family?.billingStatus ?? "NONE"}
      />
      <footer className="landing-footer container"><span>© 2026 Family Loan Ledger</span><span>One plan covers your family workspace.</span></footer>
    </main>
  );
}
