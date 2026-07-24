import { redirect } from "next/navigation";
import { DemoDashboard } from "@/components/demo-dashboard";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { DemoChild } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "SUPER_USER") redirect("/super-admin");

  const family = session.familyId
    ? await prisma.family.findUnique({
        where: { id: session.familyId },
        select: { interestPostingDay: true },
      })
    : null;

  const accounts = await prisma.loanAccount.findMany({
    where: session.role === "ADMIN"
      ? { familyId: session.familyId }
      : { id: session.accountId ?? "__none__" },
    include: { transactions: { orderBy: { effectiveAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  const children: DemoChild[] = accounts.map((account, index) => ({
    id: account.id,
    name: account.name,
    initials: account.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    email: account.email,
    purpose: account.relationship ?? "Family loan",
    rate: Number(account.annualRate),
    accent: ["#2E7D32", "#D4AF37", "#81C784"][index % 3],
    entries: account.transactions.map((entry) => ({
      id: entry.id,
      date: entry.effectiveAt.toISOString().slice(0, 10),
      type: entry.type === "LOAN" ? "Loan" : entry.type === "PAYMENT" ? "Payment" : entry.type === "INTEREST" ? "Interest" : "Adjustment",
      description: entry.description,
      amount: Number(entry.amount),
      rate: entry.rate === null ? null : Number(entry.rate),
    })),
  }));

  return (
    <DemoDashboard
      initialChildren={children}
      initialRole={session.role === "ADMIN" ? "parent" : "child"}
      demoMode={false}
      interestPostingDay={family?.interestPostingDay ?? 1}
    />
  );
}
