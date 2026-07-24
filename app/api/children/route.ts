import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const { name, email, relationship = "Child", annualRate, temporaryPassword } = body;
    if (!name || !email || annualRate === undefined || !temporaryPassword) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (String(temporaryPassword).length < 12) {
      return NextResponse.json({ error: "Temporary password must be at least 12 characters." }, { status: 400 });
    }
    const rate = Number(annualRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "Enter an annual rate between 0 and 100." }, { status: 400 });
    }

    const account = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: String(email).toLowerCase().trim(),
          passwordHash: await bcrypt.hash(String(temporaryPassword), 12),
          role: "CHILD",
          familyId: session.familyId,
        },
      });
      return tx.loanAccount.create({
        data: {
          name,
          email: String(email).toLowerCase().trim(),
          relationship,
          annualRate: rate,
          familyId: session.familyId,
          childUserId: user.id,
        },
      });
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to create account." : message }, { status });
  }
}
