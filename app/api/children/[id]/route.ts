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
    const relationship = String(body.relationship ?? "Child").trim();
    const temporaryPassword = String(body.temporaryPassword ?? "");

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a name and valid email address." }, { status: 400 });
    }
    if (temporaryPassword && temporaryPassword.length < 12) {
      return NextResponse.json(
        { error: "A replacement temporary password must be at least 12 characters." },
        { status: 400 },
      );
    }

    const current = await prisma.loanAccount.findFirst({
      where: { id, familyId: session.familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        relationship: true,
        childUser: { select: { id: true, name: true, email: true } },
      },
    });
    if (!current) return NextResponse.json({ error: "Child account not found." }, { status: 404 });

    const passwordHash = temporaryPassword ? await bcrypt.hash(temporaryPassword, 12) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const account = await tx.loanAccount.update({
        where: { id },
        data: { name, email, relationship },
        select: { id: true, name: true, email: true, relationship: true },
      });
      if (current.childUser) {
        await tx.user.update({
          where: { id: current.childUser.id },
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
        });
      }
      await writeAudit(tx, {
        action: "CHILD_ACCOUNT_UPDATED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: id,
        entityType: "LoanAccount",
        entityId: id,
        before: current,
        after: account,
      });
      return account;
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account already uses that email address." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to update the child account." : message },
      { status },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const current = await prisma.loanAccount.findFirst({
      where: { id, familyId: session.familyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        relationship: true,
        childUserId: true,
      },
    });
    if (!current) return NextResponse.json({ error: "Child account not found." }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      await tx.loanAccount.update({ where: { id }, data: { deletedAt } });
      if (current.childUserId) {
        await tx.user.update({
          where: { id: current.childUserId },
          data: {
            email: `removed+${current.childUserId}@kinledger.invalid`,
            deletedAt,
            sessionVersion: { increment: 1 },
          },
        });
      }
      await writeAudit(tx, {
        action: "CHILD_ACCOUNT_REMOVED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: id,
        entityType: "LoanAccount",
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
      { error: status === 500 ? "Unable to remove the child account." : message },
      { status },
    );
  }
}
