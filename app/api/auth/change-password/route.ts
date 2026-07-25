import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { createSession, requireSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { currentPassword, newPassword } = await request.json();

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return NextResponse.json({ error: "Current and new passwords are required." }, { status: 400 });
    }
    if (newPassword.length < 16) {
      return NextResponse.json(
        { error: "Your new password must be at least 16 characters." },
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

    await createSession({
      userId: updated.id,
      familyId: updated.familyId ?? undefined,
      role: updated.role,
      accountId: updated.childAccount?.id,
      name: updated.name,
      sessionVersion: updated.sessionVersion,
      mustChangePassword: false,
    });

    return NextResponse.json({ ok: true, role: updated.role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in again to change your password." : "Unable to change the password right now." },
      { status },
    );
  }
}
