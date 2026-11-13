import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { isAccountVisibleOnCurrentPlan } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const account = await prisma.loanAccount.findFirst({
      where: { id: body.accountId, familyId: session.familyId, deletedAt: null },
    });
    if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (!(await isAccountVisibleOnCurrentPlan(session.familyId, account.id))) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    if (!["LOAN", "PAYMENT", "ADJUSTMENT"].includes(body.type)) {
      return NextResponse.json({ error: "Invalid transaction type." }, { status: 400 });
    }
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const effectiveAt = typeof body.effectiveAt === "string" ? new Date(`${body.effectiveAt}T12:00:00Z`) : null;
    if (!description || description.length > 200) {
      return NextResponse.json({ error: "Enter a description of 200 characters or fewer." }, { status: 400 });
    }
    if (
      !effectiveAt ||
      Number.isNaN(effectiveAt.getTime()) ||
      effectiveAt.toISOString().slice(0, 10) !== body.effectiveAt
    ) {
      return NextResponse.json({ error: "Enter a valid effective date." }, { status: 400 });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "Amount must be a non-zero number." }, { status: 400 });
    }
    const signedAmount =
      body.type === "PAYMENT"
        ? -Math.abs(amount)
        : body.type === "ADJUSTMENT"
          ? amount
          : Math.abs(amount);
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          type: body.type,
          effectiveAt,
          description,
          amount: signedAmount,
          rate: body.type === "PAYMENT" ? null : (body.rate ?? account.annualRate),
        },
      });
      await writeAudit(tx, {
        action: "LEDGER_ENTRY_CREATED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: account.id,
        entityType: "LedgerEntry",
        entityId: created.id,
        after: created,
      });
      return created;
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to save entry." : message }, { status });
  }
}
