import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAprInterest, type LedgerItem } from "@/lib/finance";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const { accountId, periodStart, periodEnd } = await request.json();
    if (
      typeof periodStart !== "string" ||
      typeof periodEnd !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ||
      periodEnd <= periodStart
    ) {
      return NextResponse.json({ error: "Enter a valid interest period." }, { status: 400 });
    }

    const account = await prisma.loanAccount.findFirst({
      where: { id: accountId, familyId: session.familyId },
      include: { transactions: { orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }] } },
    });
    if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const duplicate = account.transactions.some(
      (entry) =>
        entry.type === "INTEREST" &&
        entry.effectiveAt.toISOString().slice(0, 10) === periodEnd,
    );
    if (duplicate) {
      return NextResponse.json({ error: "Interest is already posted for this date." }, { status: 409 });
    }

    const ledger: LedgerItem[] = account.transactions.map((entry) => ({
      id: entry.id,
      date: entry.effectiveAt.toISOString().slice(0, 10),
      type:
        entry.type === "LOAN"
          ? "Loan"
          : entry.type === "PAYMENT"
            ? "Payment"
            : entry.type === "INTEREST"
              ? "Interest"
              : entry.type === "RATE_CHANGE"
                ? "Rate change"
                : "Adjustment",
      description: entry.description,
      amount: Number(entry.amount),
      rate: entry.rate === null ? null : Number(entry.rate),
    }));
    const calculation = calculateAprInterest(
      ledger,
      Number(account.annualRate),
      periodStart,
      periodEnd,
    );
    if (calculation.total <= 0) {
      return NextResponse.json(
        { error: "There is no positive interest-bearing balance in this period." },
        { status: 400 },
      );
    }

    const entry = await prisma.ledgerEntry.create({
      data: {
        accountId,
        type: "INTEREST",
        effectiveAt: new Date(`${periodEnd}T12:00:00Z`),
        description: `APR interest · ${periodStart} to ${periodEnd} · ${calculation.segments.length} balance period${calculation.segments.length === 1 ? "" : "s"}`,
        amount: calculation.total,
        rate: account.annualRate,
      },
    });

    return NextResponse.json(
      {
        ...entry,
        amount: Number(entry.amount),
        rate: entry.rate === null ? null : Number(entry.rate),
        calculation,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to post interest." : message },
      { status },
    );
  }
}
