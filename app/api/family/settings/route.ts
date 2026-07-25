import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const interestPostingDay = Number(body.interestPostingDay);

    if (!name) {
      return NextResponse.json({ error: "Family workspace name is required." }, { status: 400 });
    }
    if (!Number.isInteger(interestPostingDay) || interestPostingDay < 1 || interestPostingDay > 28) {
      return NextResponse.json({ error: "Posting day must be between 1 and 28." }, { status: 400 });
    }

    const family = await prisma.$transaction(async (tx) => {
      const current = await tx.family.findUnique({
        where: { id: session.familyId },
        select: { name: true, interestPostingDay: true },
      });
      const updated = await tx.family.update({
        where: { id: session.familyId },
        data: { name, interestPostingDay },
        select: { name: true, interestPostingDay: true },
      });
      await writeAudit(tx, {
        action: "FAMILY_SETTINGS_UPDATED",
        actorId: session.userId,
        familyId: session.familyId,
        entityType: "Family",
        entityId: session.familyId,
        before: current,
        after: updated,
      });
      return updated;
    });
    return NextResponse.json(family);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to save family settings." : message },
      { status },
    );
  }
}
