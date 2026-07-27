import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const apr = Number(body.apr);
    const effectiveDate = String(body.effectiveDate ?? "");
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

    const account = await prisma.loanAccount.findFirst({
      where: { id, familyId: session.familyId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const effectiveAt = new Date(`${effectiveDate}T12:00:00Z`);
      const existing = await tx.ledgerEntry.findFirst({
        where: { accountId: id, type: "RATE_CHANGE", effectiveAt, deletedAt: null },
      });
      const entry = existing
        ? await tx.ledgerEntry.update({
            where: { id: existing.id },
            data: {
              rate: apr,
              description: `APR changed to ${apr.toFixed(3)}%`,
            },
          })
        : await tx.ledgerEntry.create({
            data: {
              accountId: id,
              type: "RATE_CHANGE",
              effectiveAt,
              description: `APR changed to ${apr.toFixed(3)}%`,
              amount: 0,
              rate: apr,
            },
          });

      const latestRate = await tx.ledgerEntry.findFirst({
        where: { accountId: id, type: "RATE_CHANGE", deletedAt: null },
        orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      });
      await tx.loanAccount.update({
        where: { id },
        data: { annualRate: latestRate?.rate ?? apr },
      });
      await writeAudit(tx, {
        action: "APR_CHANGED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: id,
        entityType: "LedgerEntry",
        entityId: entry.id,
        before: existing,
        after: entry,
      });
      return { entry, currentApr: Number(latestRate?.rate ?? apr) };
    });

    return NextResponse.json({
      id: result.entry.id,
      accountId: id,
      effectiveDate,
      apr: Number(result.entry.rate),
      currentApr: result.currentApr,
      description: result.entry.description,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to change the APR." : message },
      { status },
    );
  }
}
