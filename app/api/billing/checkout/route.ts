import { NextResponse } from "next/server";
import { createFamilyCheckoutSession, hasPaidAccess } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const plan = body.plan === "YEARLY" ? "YEARLY" : body.plan === "MONTHLY" ? "MONTHLY" : null;
    if (!plan) return NextResponse.json({ error: "Choose a monthly or yearly plan." }, { status: 400 });

    const family = await prisma.family.findUnique({ where: { id: session.familyId } });
    if (!family || family.approvalStatus !== "APPROVED") {
      return NextResponse.json({ error: "Your family workspace must be approved before checkout." }, { status: 403 });
    }
    if (hasPaidAccess(family)) {
      return NextResponse.json({ error: "This family already has an active paid plan." }, { status: 409 });
    }

    const owner = await prisma.user.findFirst({
      where: { familyId: family.id, role: "ADMIN", deletedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { email: true },
    });
    if (!owner || owner.email.toLowerCase() !== (await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } }))?.email.toLowerCase()) {
      return NextResponse.json({ error: "Only the original parent administrator can manage this family subscription." }, { status: 403 });
    }

    const url = await createFamilyCheckoutSession(family, owner, plan);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 503;
    return NextResponse.json({ error: status === 503 ? "Checkout is unavailable. Please try again later." : message }, { status });
  }
}
