import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { childAccount: true, family: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 });
    }

    if (user.role !== "SUPER_USER" && user.family?.approvalStatus !== "APPROVED") {
      const rejected = user.family?.approvalStatus === "REJECTED";
      return NextResponse.json(
        {
          error: rejected
            ? "This parent-lender application was not approved. Contact KinLedger support for help."
            : "Your parent-lender application is still waiting for approval.",
          status: user.family?.approvalStatus,
        },
        { status: 403 },
      );
    }

    await createSession({
      userId: user.id,
      familyId: user.familyId ?? undefined,
      role: user.role,
      accountId: user.childAccount?.id,
      name: user.name,
    });

    return NextResponse.json({ ok: true, role: user.role });
  } catch {
    return NextResponse.json(
      { error: "Sign in is unavailable until the database is connected." },
      { status: 503 },
    );
  }
}
