import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRecoveryCodes, encryptTotpSecret, verifyTotp } from "@/lib/mfa";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { createSession, requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.role !== "SUPER_USER" || session.mustChangePassword) {
      return NextResponse.json({ error: "Super-user authentication is required." }, { status: 403 });
    }
    const ipLimit = await checkRateLimit({ scope: "mfa-setup-ip", identity: getClientIp(request), limit: 20, windowMs: 15 * 60 * 1000 });
    const userLimit = await checkRateLimit({ scope: "mfa-setup-user", identity: session.userId, limit: 10, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed || !userLimit.allowed) {
      return rateLimitResponse(Math.max(!ipLimit.allowed ? ipLimit.retryAfterSeconds : 0, !userLimit.allowed ? userLimit.retryAfterSeconds : 0));
    }

    const body = await request.json();
    if (typeof body.password !== "string" || typeof body.secret !== "string" || typeof body.code !== "string") {
      return NextResponse.json({ error: "Password, authenticator key, and code are required." }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || user.mfaEnabledAt || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Unable to enable MFA. Check your password and try again." }, { status: 401 });
    }
    if (!verifyTotp(body.secret, body.code)) {
      return NextResponse.json({ error: "The authenticator code is incorrect." }, { status: 401 });
    }

    const { codes, hashes } = createRecoveryCodes();
    const updated = await prisma.user.updateMany({
      where: { id: user.id, mfaEnabledAt: null },
      data: {
        mfaSecret: encryptTotpSecret(body.secret),
        mfaEnabledAt: new Date(),
        mfaRecoveryCodes: hashes,
      },
    });
    if (updated.count !== 1) return NextResponse.json({ error: "MFA was already enabled. Refresh and sign in again." }, { status: 409 });

    await createSession({ ...session, mfaVerified: true });
    return NextResponse.json({ enabled: true, recoveryCodes: codes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in again." : status === 403 ? "Super-user authentication is required." : "Unable to enable MFA." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
