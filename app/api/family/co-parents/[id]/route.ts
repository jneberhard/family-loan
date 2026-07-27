import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const temporaryPassword = String(body.temporaryPassword ?? "");

    if (id === session.userId) {
      return NextResponse.json({ error: "Use your password settings to manage your own account." }, { status: 400 });
    }
    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a name and valid email address." }, { status: 400 });
    }
    if (temporaryPassword && temporaryPassword.length < 12) {
      return NextResponse.json(
        { error: "A replacement temporary password must be at least 12 characters." },
        { status: 400 },
      );
    }

    const current = await prisma.user.findFirst({
      where: { id, familyId: session.familyId, role: "ADMIN", deletedAt: null },
      select: { id: true, name: true, email: true },
    });
    if (!current) return NextResponse.json({ error: "Co-parent not found." }, { status: 404 });

    const passwordHash = temporaryPassword ? await bcrypt.hash(temporaryPassword, 12) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const coParent = await tx.user.update({
        where: { id },
        data: {
          name,
          email,
          ...(passwordHash
            ? {
                passwordHash,
                mustChangePassword: true,
                sessionVersion: { increment: 1 },
              }
            : {}),
        },
        select: { id: true, name: true, email: true },
      });
      await writeAudit(tx, {
        action: "CO_PARENT_UPDATED",
        actorId: session.userId,
        familyId: session.familyId,
        entityType: "User",
        entityId: id,
        before: current,
        after: coParent,
      });
      return coParent;
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account already uses that email address." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to update the co-parent." : message },
      { status },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    if (id === session.userId) {
      return NextResponse.json({ error: "You cannot remove your own administrator account." }, { status: 400 });
    }

    const current = await prisma.user.findFirst({
      where: { id, familyId: session.familyId, role: "ADMIN", deletedAt: null },
      select: { id: true, name: true, email: true },
    });
    if (!current) return NextResponse.json({ error: "Co-parent not found." }, { status: 404 });

    const activeAdmins = await prisma.user.count({
      where: { familyId: session.familyId, role: "ADMIN", deletedAt: null },
    });
    if (activeAdmins <= 1) {
      return NextResponse.json(
        { error: "A family must keep at least one administrator." },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      await tx.user.update({
        where: { id },
        data: {
          email: `removed+${id}@kinledger.invalid`,
          deletedAt,
          sessionVersion: { increment: 1 },
        },
      });
      await writeAudit(tx, {
        action: "CO_PARENT_REMOVED",
        actorId: session.userId,
        familyId: session.familyId,
        entityType: "User",
        entityId: id,
        before: current,
        after: { deletedAt },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to remove the co-parent." : message },
      { status },
    );
  }
}
