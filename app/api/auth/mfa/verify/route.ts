import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptTotpSecret, matchingRecoveryCode, verifyTotp } from "@/lib/mfa";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { createSession, requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.role !== "SUPER_USER" || session.mustChangePassword) {
      return NextResponse.json({ error: "Super-user authentication is required." }, { status: 403 });
    }
    const ipLimit = await checkRateLimit({ scope: "mfa-verify-ip", identity: getClientIp(request), limit: 30, windowMs: 15 * 60 * 1000 });
    const userLimit = await checkRateLimit({ scope: "mfa-verify-user", identity: session.userId, limit: 10, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed || !userLimit.allowed) {
      return rateLimitResponse(Math.max(!ipLimit.allowed ? ipLimit.retryAfterSeconds : 0, !userLimit.allowed ? userLimit.retryAfterSeconds : 0));
    }

    const body = await request.json();
    if (typeof body.code !== "string") return NextResponse.json({ error: "Enter an authenticator or recovery code." }, { status: 400 });
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { mfaSecret: true, mfaEnabledAt: true, mfaRecoveryCodes: true, sessionVersion: true, familyId: true, role: true, name: true, mustChangePassword: true, childAccount: { select: { id: true } } },
    });
    if (!user?.mfaEnabledAt || !user.mfaSecret) {
      return NextResponse.json({ error: "Authenticator setup is required." }, { status: 403 });
    }

    const secret = decryptTotpSecret(user.mfaSecret);
    const code = body.code.trim();
    let valid = verifyTotp(secret, code);
    if (!valid) {
      const recoveryIndex = matchingRecoveryCode(code, user.mfaRecoveryCodes);
      if (recoveryIndex >= 0) {
        const remainingCodes = user.mfaRecoveryCodes.filter((_, index) => index !== recoveryIndex);
        const consumed = await prisma.user.updateMany({
          where: { id: session.userId, mfaRecoveryCodes: { equals: user.mfaRecoveryCodes } },
          data: { mfaRecoveryCodes: remainingCodes },
        });
        valid = consumed.count === 1;
      }
    }
    if (!valid) return NextResponse.json({ error: "The code is incorrect or has already been used." }, { status: 401 });

    await createSession({
      userId: session.userId,
      familyId: user.familyId ?? undefined,
      role: "SUPER_USER",
      accountId: user.childAccount?.id,
      name: user.name,
      sessionVersion: user.sessionVersion,
      mustChangePassword: user.mustChangePassword,
      mfaVerified: true,
    });
    return NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in again." : status === 403 ? "Super-user authentication is required." : "Unable to verify MFA." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
