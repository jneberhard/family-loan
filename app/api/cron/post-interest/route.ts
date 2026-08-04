import { NextResponse } from "next/server";
import { postAccountInterest } from "@/lib/post-interest";
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
  const today = localDateParts(new Date(), timeZone);
  const accounts = await prisma.loanAccount.findMany({
    where: {
      deletedAt: null,
      family: {
        approvalStatus: "APPROVED",
        interestPostingDay: today.day,
      },
    },
    select: { id: true },
  });

  let posted = 0;
  let skipped = 0;
  let failed = 0;
  for (const account of accounts) {
    try {
      const result = await postAccountInterest({
        accountId: account.id,
        periodEnd: today.key,
        postingDay: today.day,
      });
      if (result.status === "posted") posted += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "Automatic interest posting failed:",
        account.id,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    date: today.key,
    timeZone,
    eligible: accounts.length,
    posted,
    skipped,
    failed,
  });
}
