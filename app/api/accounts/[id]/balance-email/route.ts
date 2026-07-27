import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { sendBalanceEmail } from "@/lib/balance-email";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

function balanceOf(transactions: { amount: { toString(): string } }[]) {
  return transactions.reduce((sum, entry) => sum + Number(entry.amount), 0);
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const account = await prisma.loanAccount.findFirst({
      where: { id, familyId: session.familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        annualRate: true,
        family: { select: { name: true } },
        transactions: {
          where: { deletedAt: null },
          select: { amount: true },
        },
      },
    });
    if (!account) return NextResponse.json({ error: "Child account not found." }, { status: 404 });

    const balance = balanceOf(account.transactions);
    const asOf = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone: process.env.REMINDER_TIME_ZONE ?? "America/Denver",
    }).format(new Date());

    await sendBalanceEmail({
      childName: account.name,
      childEmail: account.email,
      familyName: account.family.name,
      balance,
      apr: Number(account.annualRate),
      asOf,
    });
    await prisma.$transaction((tx) =>
      writeAudit(tx, {
        action: "BALANCE_EMAIL_SENT",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: id,
        entityType: "LoanAccount",
        entityId: id,
        after: { recipient: account.email, balance, asOf },
      }),
    );
    return NextResponse.json({ ok: true, balance, recipient: account.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "EMAIL_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Balance email is not configured yet." }, { status: 503 });
    }
    if (message === "EMAIL_SEND_FAILED") {
      return NextResponse.json({ error: "The balance email could not be sent." }, { status: 502 });
    }
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to send the balance email." : message },
      { status },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const reminderDay =
      body.reminderDay === null || body.reminderDay === "" ? null : Number(body.reminderDay);
    if (
      reminderDay !== null &&
      (!Number.isInteger(reminderDay) || reminderDay < 1 || reminderDay > 28)
    ) {
      return NextResponse.json(
        { error: "Reminder day must be between 1 and 28." },
        { status: 400 },
      );
    }

    const current = await prisma.loanAccount.findFirst({
      where: { id, familyId: session.familyId, deletedAt: null },
      select: { id: true, balanceReminderDay: true },
    });
    if (!current) return NextResponse.json({ error: "Child account not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const account = await tx.loanAccount.update({
        where: { id },
        data: { balanceReminderDay: reminderDay },
        select: { id: true, balanceReminderDay: true },
      });
      await writeAudit(tx, {
        action: "BALANCE_REMINDER_UPDATED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: id,
        entityType: "LoanAccount",
        entityId: id,
        before: current,
        after: account,
      });
      return account;
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to save the reminder schedule." : message },
      { status },
    );
  }
}
