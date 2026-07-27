import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

async function currentApr(
  tx: Prisma.TransactionClient,
  accountId: string,
  fallback: Prisma.Decimal,
) {
  const latestRate = await tx.ledgerEntry.findFirst({
    where: { accountId, type: "RATE_CHANGE", deletedAt: null },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
  if (latestRate?.rate !== null && latestRate?.rate !== undefined) return latestRate.rate;

  const originalLoan = await tx.ledgerEntry.findFirst({
    where: { accountId, type: "LOAN", rate: { not: null }, deletedAt: null },
    orderBy: [{ effectiveAt: "asc" }, { createdAt: "asc" }],
  });
  return originalLoan?.rate ?? fallback;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const current = await prisma.ledgerEntry.findFirst({
      where: { id, deletedAt: null, account: { familyId: session.familyId, deletedAt: null } },
      include: { account: { select: { annualRate: true } } },
    });
    if (!current) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    const body = await request.json();

    if (current.type === "RATE_CHANGE") {
      const effectiveDate = String(body.effectiveAt ?? current.effectiveAt.toISOString().slice(0, 10));
      const apr = body.rate === undefined ? Number(current.rate) : Number(body.rate);
      const today = new Date().toISOString().slice(0, 10);
      if (!Number.isFinite(apr) || apr < 0 || apr > 100) {
        return NextResponse.json({ error: "APR must be between 0 and 100." }, { status: 400 });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || effectiveDate > today) {
        return NextResponse.json(
          { error: "Choose a valid effective date that is not in the future." },
          { status: 400 },
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const effectiveAt = new Date(`${effectiveDate}T12:00:00Z`);
        const duplicate = await tx.ledgerEntry.findFirst({
          where: {
            accountId: current.accountId,
            type: "RATE_CHANGE",
            effectiveAt,
            deletedAt: null,
            id: { not: id },
          },
        });
        if (duplicate) throw new Error("DUPLICATE_RATE_DATE");

        const updated = await tx.ledgerEntry.update({
          where: { id },
          data: {
            effectiveAt,
            rate: apr,
            description: `APR changed to ${apr.toFixed(3)}%`,
          },
        });
        const aprNow = await currentApr(tx, current.accountId, current.account.annualRate);
        await tx.loanAccount.update({
          where: { id: current.accountId },
          data: { annualRate: aprNow },
        });
        await writeAudit(tx, {
          action: "APR_CHANGE_UPDATED",
          actorId: session.userId,
          familyId: session.familyId,
          accountId: current.accountId,
          entityType: "LedgerEntry",
          entityId: id,
          before: current,
          after: updated,
        });
        return { updated, aprNow };
      });

      return NextResponse.json({
        ...result.updated,
        effectiveDate,
        rate: Number(result.updated.rate),
        currentApr: Number(result.aprNow),
      });
    }

    const type = body.type ?? current.type;
    if (!["LOAN", "PAYMENT", "INTEREST", "ADJUSTMENT"].includes(type)) {
      return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
    }
    const rawAmount = body.amount === undefined ? Number(current.amount) : Number(body.amount);
    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      return NextResponse.json({ error: "Amount must be a non-zero number." }, { status: 400 });
    }
    const amount =
      type === "PAYMENT"
        ? -Math.abs(rawAmount)
        : type === "ADJUSTMENT"
          ? rawAmount
          : Math.abs(rawAmount);
    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.ledgerEntry.update({
        where: { id },
        data: {
          type,
          effectiveAt: body.effectiveAt ? new Date(`${body.effectiveAt}T12:00:00Z`) : undefined,
          description: body.description,
          amount,
          rate: type === "PAYMENT" ? null : (body.rate ?? current.rate ?? current.account.annualRate),
        },
      });
      await writeAudit(tx, {
        action: "LEDGER_ENTRY_UPDATED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: current.accountId,
        entityType: "LedgerEntry",
        entityId: id,
        before: current,
        after: updated,
      });
      return updated;
    });
    return NextResponse.json(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DUPLICATE_RATE_DATE") {
      return NextResponse.json(
        { error: "Another APR change already uses that effective date." },
        { status: 409 },
      );
    }
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to update entry." : message },
      { status },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const current = await prisma.ledgerEntry.findFirst({
      where: { id, deletedAt: null, account: { familyId: session.familyId, deletedAt: null } },
    });
    if (!current) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    const result = await prisma.$transaction(async (tx) => {
      const removed = await tx.ledgerEntry.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      let aprNow: Prisma.Decimal | undefined;
      if (current.type === "RATE_CHANGE") {
        const account = await tx.loanAccount.findUniqueOrThrow({ where: { id: current.accountId } });
        aprNow = await currentApr(tx, current.accountId, account.annualRate);
        await tx.loanAccount.update({
          where: { id: current.accountId },
          data: { annualRate: aprNow },
        });
      }
      await writeAudit(tx, {
        action: current.type === "RATE_CHANGE" ? "APR_CHANGE_REMOVED" : "LEDGER_ENTRY_REMOVED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: current.accountId,
        entityType: "LedgerEntry",
        entityId: id,
        before: current,
        after: removed,
      });
      return { aprNow };
    });
    return NextResponse.json({
      ok: true,
      currentApr: result.aprNow === undefined ? undefined : Number(result.aprNow),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to delete entry." : message },
      { status },
    );
  }
}
