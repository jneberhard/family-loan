import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateRunningLedger, type LedgerItem } from "@/lib/finance";
import { requireSession } from "@/lib/session";
import { hasPaidAccess } from "@/lib/billing";

export async function GET() {
  try {
    const session = await requireSession();
    if (session.mustChangePassword || session.role === "SUPER_USER") {
      return NextResponse.json({ error: "This account cannot open the family app yet." }, { status: 403 });
    }

    const family = session.familyId
      ? await prisma.family.findUnique({
          where: { id: session.familyId },
          select: { name: true, interestPostingDay: true, plan: true, billingStatus: true, subscriptionPeriodEnd: true },
        })
      : null;
    const accounts = await prisma.loanAccount.findMany({
        where:
          session.role === "ADMIN"
            ? { familyId: session.familyId, deletedAt: null }
            : { id: session.accountId ?? "__none__", deletedAt: null },
        include: {
          transactions: {
            where: { deletedAt: null },
            orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        ...(!family || !hasPaidAccess(family) ? { take: 1 } : {}),
      });

    return NextResponse.json(
      {
        viewer: { name: session.name, role: session.role },
        family: { name: family?.name ?? "Family workspace", interestPostingDay: family?.interestPostingDay ?? 1 },
        accounts: accounts.map((account) => {
          const entries: LedgerItem[] = account.transactions.map((entry) => ({
            id: entry.id,
            date: entry.effectiveAt.toISOString().slice(0, 10),
            type:
              entry.type === "RATE_CHANGE"
                ? "Rate change"
                : entry.type === "LOAN"
                  ? "Loan"
                  : entry.type === "PAYMENT"
                    ? "Payment"
                    : entry.type === "INTEREST"
                      ? "Interest"
                      : "Adjustment",
            description: entry.description,
            amount: Number(entry.amount),
            rate: entry.rate === null ? null : Number(entry.rate),
          }));
          const ledger = calculateRunningLedger(entries);
          return {
            id: account.id,
            name: account.name,
            annualRate: Number(account.annualRate),
            balance: ledger.at(-1)?.balance ?? 0,
            entries: ledger.reverse(),
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in again to continue." : "Unable to load your family right now." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
