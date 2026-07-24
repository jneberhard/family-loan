import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

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

    const family = await prisma.family.update({
      where: { id: session.familyId },
      data: { name, interestPostingDay },
      select: { name: true, interestPostingDay: true },
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
