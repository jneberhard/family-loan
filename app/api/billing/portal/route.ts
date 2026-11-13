import { NextResponse } from "next/server";
import { getStripe, getPublicAppUrl } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function POST() {
  try {
    const session = await requireAdmin();
    const family = await prisma.family.findUnique({ where: { id: session.familyId }, select: { id: true, stripeCustomerId: true } });
    if (!family?.stripeCustomerId) return NextResponse.json({ error: "No billing account is linked to this family yet." }, { status: 404 });
    const owner = await prisma.user.findFirst({ where: { familyId: family.id, role: "ADMIN", deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true } });
    if (owner?.id !== session.userId) return NextResponse.json({ error: "Only the original parent administrator can manage billing." }, { status: 403 });
    const portal = await getStripe().billingPortal.sessions.create({ customer: family.stripeCustomerId, return_url: `${getPublicAppUrl()}/pricing` });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 503;
    return NextResponse.json({ error: status === 503 ? "Billing management is unavailable." : message }, { status });
  }
}
