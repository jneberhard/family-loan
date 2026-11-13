import { redirect } from "next/navigation";
import { DemoDashboard } from "@/components/demo-dashboard";
import { InactivityTimeout } from "@/components/inactivity-timeout";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { DemoChild } from "@/lib/demo-data";
import { hasPaidAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  if (session.role === "SUPER_USER") redirect("/super-admin");

  const family = session.familyId
      ? await prisma.family.findUnique({
        where: { id: session.familyId },
        select: {
          name: true,
          interestPostingDay: true,
          plan: true,
          billingStatus: true,
          subscriptionPeriodEnd: true,
          users: {
            where: { role: "ADMIN", deletedAt: null },
            select: { id: true, name: true, email: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      })
    : null;

  const accounts = await prisma.loanAccount.findMany({
    where: session.role === "ADMIN"
      ? { familyId: session.familyId, deletedAt: null }
      : { id: session.accountId ?? "__none__", deletedAt: null },
    include: {
      transactions: {
        where: { deletedAt: null },
        orderBy: { effectiveAt: "asc" },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    ...(!family || !hasPaidAccess(family) ? { take: 1 } : {}),
  });

  const children: DemoChild[] = accounts.map((account, index) => ({
    id: account.id,
    name: account.name,
    initials: account.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    email: account.email,
    purpose: account.relationship ?? "Family loan",
    rate: Number(account.annualRate),
    balanceReminderDay: account.balanceReminderDay,
    accent: ["#2E7D32", "#D4AF37", "#81C784"][index % 3],
    entries: account.transactions.map((entry) => ({
      id: entry.id,
      date: entry.effectiveAt.toISOString().slice(0, 10),
      type: entry.type === "LOAN" ? "Loan" : entry.type === "PAYMENT" ? "Payment" : entry.type === "INTEREST" ? "Interest" : entry.type === "RATE_CHANGE" ? "Rate change" : "Adjustment",
      description: entry.description,
      amount: Number(entry.amount),
      rate: entry.rate === null ? null : Number(entry.rate),
    })),
  }));

  return (
    <InactivityTimeout>
    <DemoDashboard
      initialChildren={children}
      initialRole={session.role === "ADMIN" ? "parent" : "child"}
      demoMode={false}
      hasPaidFamily={Boolean(family && hasPaidAccess(family))}
      interestPostingDay={family?.interestPostingDay ?? 1}
      familyName={family?.name ?? "Family workspace"}
      viewerName={session.name}
      initialAdmins={(family?.users ?? []).slice(0, family && hasPaidAccess(family) ? undefined : 1).map((admin) => ({
        ...admin,
        isCurrent: admin.id === session.userId,
      }))}
    />
    </InactivityTimeout>
  );
}
