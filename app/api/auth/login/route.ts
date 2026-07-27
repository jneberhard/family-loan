import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-family-loan-password", 12);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim(), deletedAt: null },
      include: { childAccount: true, family: true },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts >= MAX_FAILED_ATTEMPTS ? 0 : attempts,
            lockedUntil:
              attempts >= MAX_FAILED_ATTEMPTS
                ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
                : null,
          },
        });
      }
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

    const signedInUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
      include: { childAccount: true },
    });

    await createSession({
      userId: signedInUser.id,
      familyId: signedInUser.familyId ?? undefined,
      role: signedInUser.role,
      accountId: signedInUser.childAccount?.id,
      name: signedInUser.name,
      sessionVersion: signedInUser.sessionVersion,
      mustChangePassword: signedInUser.mustChangePassword,
    });

    return NextResponse.json({
      ok: true,
      role: signedInUser.role,
      mustChangePassword: signedInUser.mustChangePassword,
    });
  } catch {
    return NextResponse.json(
      { error: "Sign in is unavailable until the database is connected." },
      { status: 503 },
    );
  }
}
