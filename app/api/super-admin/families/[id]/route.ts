import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperUser } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperUser();
    const { id } = await params;
    const body = await request.json();
    const approvalStatus = String(body.approvalStatus ?? "");
    const reviewNote = String(body.reviewNote ?? "").trim();

    if (approvalStatus !== "APPROVED" && approvalStatus !== "REJECTED") {
      return NextResponse.json({ error: "Choose approved or rejected." }, { status: 400 });
    }

    const family = await prisma.family.update({
      where: { id },
      data: {
        approvalStatus,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
      },
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        reviewedAt: true,
        reviewNote: true,
      },
    });

    return NextResponse.json(family);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to review this application." : message },
      { status },
    );
  }
}
