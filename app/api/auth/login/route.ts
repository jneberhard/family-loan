import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createMobileSessionToken, createSession } from "@/lib/session";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { createFamilyCheckoutSession, isUserAllowedOnCurrentPlan } from "@/lib/billing";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("not-a-real-family-loan-password", 12);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ipLimit = await checkRateLimit({
      scope: "login-ip",
      identity: getClientIp(request),
      limit: 30,
      windowMs: 15 * 60 * 1000,
    });
    const emailLimit = await checkRateLimit({
      scope: "login-email",
      identity: normalizedEmail,
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return rateLimitResponse(Math.max(
        !ipLimit.allowed ? ipLimit.retryAfterSeconds : 0,
        !emailLimit.allowed ? emailLimit.retryAfterSeconds : 0,
      ));
    }

    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
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

    if (
      user.role === "ADMIN" &&
      user.family?.approvalStatus === "PENDING" &&
      (user.family.plan === "MONTHLY" || user.family.plan === "YEARLY")
    ) {
      if (request.headers.get("x-kinledger-client") === "native") {
        return NextResponse.json({ error: "Finish subscription checkout on the website to activate this family." }, { status: 403 });
      }
      if (user.family.billingStatus === "ACTIVE") {
        return NextResponse.json({ error: "Payment received. Family activation is finishing; please sign in again shortly." }, { status: 403 });
      }
      const checkoutUrl = await createFamilyCheckoutSession(user.family, { email: user.email }, user.family.plan);
      return NextResponse.json({ checkoutUrl }, { headers: { "Cache-Control": "no-store" } });
    }

    if (user.role !== "SUPER_USER" && user.family?.approvalStatus !== "APPROVED") {
      const rejected = user.family?.approvalStatus === "REJECTED";
      return NextResponse.json(
        {
          error: rejected
            ? "This parent-lender application was not approved. Contact Family Loan Ledger support for help."
            : "Your parent-lender application is still waiting for approval.",
          status: user.family?.approvalStatus,
        },
        { status: 403 },
      );
    }
    if (user.role !== "SUPER_USER" && user.family && !(await isUserAllowedOnCurrentPlan(user, user.family))) {
      return NextResponse.json(
        { error: "This account is hidden while the family is on the free plan. The family administrator can restore access by renewing the subscription." },
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

    const session = {
      userId: signedInUser.id,
      familyId: signedInUser.familyId ?? undefined,
      role: signedInUser.role,
      accountId: signedInUser.childAccount?.id,
      name: signedInUser.name,
      sessionVersion: signedInUser.sessionVersion,
      mustChangePassword: signedInUser.mustChangePassword,
      mfaVerified: false,
    } as const;
    await createSession(session);

    const response: Record<string, unknown> = {
      ok: true,
      role: signedInUser.role,
      mustChangePassword: signedInUser.mustChangePassword,
      mfaRequired: signedInUser.role === "SUPER_USER",
      mfaSetupRequired: signedInUser.role === "SUPER_USER" && !signedInUser.mfaEnabledAt,
    };
    if (request.headers.get("x-kinledger-client") === "native" && signedInUser.role !== "SUPER_USER") {
      response.token = await createMobileSessionToken(session);
    }
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Sign in is unavailable until the database is connected." },
      { status: 503 },
    );
  }
}
