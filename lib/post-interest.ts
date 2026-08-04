import { prisma } from "@/lib/prisma";
import { calculateAprInterest, type LedgerItem } from "@/lib/finance";
import { writeAudit } from "@/lib/audit";
import type { LedgerEntry as PrismaLedgerEntry } from "@prisma/client";

type PostInterestOptions = {
  accountId: string;
  periodEnd: string;
  familyId?: string;
  actorId?: string;
  auditAction?: string;
  postingDay?: number;
};

type PostInterestResult =
  | { status: "not_found" | "duplicate" | "no_interest" }
  | {
      status: "posted";
      entry: PrismaLedgerEntry;
      calculation: ReturnType<typeof calculateAprInterest>;
      periodStart: string;
    };

function toLedgerItem(entry: {
  id: string;
  effectiveAt: Date;
  type: "LOAN" | "PAYMENT" | "INTEREST" | "ADJUSTMENT" | "RATE_CHANGE";
  description: string;
  amount: { toString(): string };
  rate: { toString(): string } | null;
}): LedgerItem {
  return {
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
  };
}

export async function postAccountInterest({
  accountId,
  periodEnd,
  familyId,
  actorId,
  auditAction = "INTEREST_AUTO_POSTED",
  postingDay,
}: PostInterestOptions): Promise<PostInterestResult> {
  return prisma.$transaction(async (tx) => {
    const lockKey = `interest:${accountId}:${periodEnd}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const account = await tx.loanAccount.findFirst({
      where: {
        id: accountId,
        deletedAt: null,
        ...(familyId ? { familyId } : {}),
        ...(postingDay
          ? { family: { approvalStatus: "APPROVED", interestPostingDay: postingDay } }
          : {}),
      },
      include: {
        transactions: {
          where: { deletedAt: null },
          orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    if (!account) return { status: "not_found" };

    const ledger = account.transactions.map(toLedgerItem);
    if (ledger.some((entry) => entry.type === "Interest" && entry.date === periodEnd)) {
      return { status: "duplicate" };
    }

    const eligible = ledger.filter((entry) => entry.date < periodEnd);
    const latestInterest = eligible.filter((entry) => entry.type === "Interest").at(-1);
    const periodStart = latestInterest?.date ?? eligible[0]?.date;
    if (!periodStart || periodStart >= periodEnd) return { status: "no_interest" };

    const calculation = calculateAprInterest(
      ledger,
      Number(account.annualRate),
      periodStart,
      periodEnd,
    );
    if (calculation.total <= 0) return { status: "no_interest" };

    const entry = await tx.ledgerEntry.create({
      data: {
        accountId,
        type: "INTEREST",
        effectiveAt: new Date(`${periodEnd}T12:00:00Z`),
        description: `APR interest · ${periodStart} to ${periodEnd} · ${calculation.segments.length} balance period${calculation.segments.length === 1 ? "" : "s"}`,
        amount: calculation.total,
        rate: account.annualRate,
      },
    });
    await writeAudit(tx, {
      action: auditAction,
      actorId,
      familyId: account.familyId,
      accountId,
      entityType: "LedgerEntry",
      entityId: entry.id,
      after: { ...entry, calculation, periodStart, periodEnd },
    });

    return { status: "posted", entry, calculation, periodStart };
  }, { timeout: 15_000 });
}
