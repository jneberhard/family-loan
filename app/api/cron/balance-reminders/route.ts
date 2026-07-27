import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { sendBalanceEmail } from "@/lib/balance-email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: value("year"),
    month: value("month"),
    day: Number(value("day")),
    key: `${value("year")}-${value("month")}-${value("day")}`,
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const timeZone = process.env.REMINDER_TIME_ZONE ?? "America/Denver";
  const now = new Date();
  const today = localDateParts(now, timeZone);
  const accounts = await prisma.loanAccount.findMany({
    where: {
      deletedAt: null,
      balanceReminderDay: today.day,
      childUser: { deletedAt: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      annualRate: true,
      lastBalanceReminderAt: true,
      familyId: true,
      family: { select: { name: true } },
      transactions: {
        where: { deletedAt: null },
        select: { amount: true },
      },
    },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const account of accounts) {
    if (
      account.lastBalanceReminderAt &&
      localDateParts(account.lastBalanceReminderAt, timeZone).key === today.key
    ) {
      skipped += 1;
      continue;
    }
    const balance = account.transactions.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const asOf = new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeZone,
    }).format(now);
    try {
      await sendBalanceEmail({
        childName: account.name,
        childEmail: account.email,
        familyName: account.family.name,
        balance,
        apr: Number(account.annualRate),
        asOf,
        idempotencyKey: `balance-reminder/${account.id}/${today.key}`,
      });
      await prisma.$transaction(async (tx) => {
        await tx.loanAccount.update({
          where: { id: account.id },
          data: { lastBalanceReminderAt: now },
        });
        await writeAudit(tx, {
          action: "BALANCE_REMINDER_SENT",
          familyId: account.familyId,
          accountId: account.id,
          entityType: "LoanAccount",
          entityId: account.id,
          after: { recipient: account.email, balance, asOf },
        });
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "Balance reminder failed:",
        account.id,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return NextResponse.json({ ok: true, date: today.key, timeZone, sent, skipped, failed });
}
