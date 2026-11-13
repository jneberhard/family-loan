import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";
import { requireSuperUser } from "@/lib/session";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperUser();
    const { id } = await context.params;
    const promotion = await getStripe().promotionCodes.update(id, { active: false });
    return NextResponse.json({ id: promotion.id, active: promotion.active });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 503;
    return NextResponse.json({ error: status === 503 ? "Unable to disable this coupon code." : message }, { status });
  }
}
