import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createMobileSessionToken, createSession, requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { currentPassword, newPassword } = await request.json();

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Current and new passwords are required." }, { status: 400 });
    }
    if (newPassword.length < 12) {
      return NextResponse.json(
        { error: "Your new password must be at least 12 characters." },
        { status: 400 },
      );
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "Choose a password that is different from your current password." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { childAccount: true },
    });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          sessionVersion: { increment: 1 },
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        include: { childAccount: true },
      });
      await tx.mobileSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await writeAudit(tx, {
        action: "PASSWORD_CHANGED",
        actorId: user.id,
        familyId: user.familyId ?? undefined,
        accountId: user.childAccount?.id,
        entityType: "User",
        entityId: user.id,
      });
      return changed;
    });

    const updatedSession = {
      userId: updated.id,
      familyId: updated.familyId ?? undefined,
      role: updated.role,
      accountId: updated.childAccount?.id,
      name: updated.name,
      sessionVersion: updated.sessionVersion,
      mustChangePassword: false,
    } as const;
    await createSession(updatedSession);

    const response: Record<string, unknown> = { ok: true, role: updated.role };
    if (request.headers.get("x-kinledger-client") === "native") {
      response.token = await createMobileSessionToken(updatedSession);
    }
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in again to change your password." : "Unable to change the password right now." },
      { status },
    );
  }
}
