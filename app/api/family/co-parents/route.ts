import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const temporaryPassword = String(body.temporaryPassword ?? "");

    if (!name || !email || !temporaryPassword) {
      return NextResponse.json({ error: "Name, email, and temporary password are required." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (temporaryPassword.length < 12) {
      return NextResponse.json({ error: "Temporary password must be at least 12 characters." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const coParent = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: "ADMIN",
          familyId: session.familyId,
          mustChangePassword: true,
        },
        select: { id: true, name: true, email: true },
      });
      await writeAudit(tx, {
        action: "CO_PARENT_CREATED",
        actorId: session.userId,
        familyId: session.familyId,
        entityType: "User",
        entityId: created.id,
        after: { name: created.name, email: created.email, role: "ADMIN" },
      });
      return created;
    });

    return NextResponse.json(coParent, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to add the co-parent account." : message },
      { status },
    );
  }
}
