import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const current = await prisma.ledgerEntry.findFirst({
      where: { id, account: { familyId: session.familyId } },
      include: { account: { select: { annualRate: true } } },
    });
    if (!current) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    const body = await request.json();
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
    const entry = await prisma.ledgerEntry.update({
      where: { id },
      data: {
        type,
        effectiveAt: body.effectiveAt ? new Date(`${body.effectiveAt}T12:00:00Z`) : undefined,
        description: body.description,
        amount,
        rate: type === "PAYMENT" ? null : (body.rate ?? current.rate ?? current.account.annualRate),
      },
    });
    return NextResponse.json(entry);
  } catch {
    return NextResponse.json({ error: "Unable to update entry." }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const current = await prisma.ledgerEntry.findFirst({
      where: { id, account: { familyId: session.familyId } },
    });
    if (!current) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    await prisma.ledgerEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete entry." }, { status: 500 });
  }
}
