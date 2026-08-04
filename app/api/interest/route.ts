import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { postAccountInterest } from "@/lib/post-interest";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const { accountId, periodStart, periodEnd } = await request.json();
    if (
      typeof accountId !== "string" ||
      typeof periodStart !== "string" ||
      typeof periodEnd !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ||
      periodEnd <= periodStart
    ) {
      return NextResponse.json({ error: "Enter a valid interest period." }, { status: 400 });
    }

    const result = await postAccountInterest({
      accountId,
      periodEnd,
      familyId: session.familyId,
      actorId: session.userId,
      auditAction: "INTEREST_POSTED",
    });
    if (result.status === "not_found") {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (result.status === "duplicate") {
      return NextResponse.json({ error: "Interest is already posted for this date." }, { status: 409 });
    }
    if (result.status === "no_interest") {
      return NextResponse.json(
        { error: "There is no positive interest-bearing balance in this period." },
        { status: 400 },
      );
    }
    if (result.status !== "posted") {
      return NextResponse.json({ error: "Unable to post interest." }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...result.entry,
        amount: Number(result.entry.amount),
        rate: result.entry.rate === null ? null : Number(result.entry.rate),
        calculation: result.calculation,
        periodStart: result.periodStart,
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
