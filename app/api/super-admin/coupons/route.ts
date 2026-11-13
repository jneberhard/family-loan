import { NextResponse } from "next/server";
import { getStripe } from "@/lib/billing";
import { requireSuperUser } from "@/lib/session";

export async function GET() {
  try {
    await requireSuperUser();
    const stripe = getStripe();
    const { data } = await stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] });
    return NextResponse.json({ codes: data.map((promotion) => {
      const coupon = typeof promotion.promotion.coupon === "string" ? null : promotion.promotion.coupon;
      return {
        id: promotion.id,
        code: promotion.code,
        active: promotion.active,
        expiresAt: promotion.expires_at,
        maxRedemptions: promotion.max_redemptions,
        timesRedeemed: promotion.times_redeemed,
        percentOff: coupon?.percent_off ?? null,
        duration: coupon?.duration ?? null,
        durationInMonths: coupon?.duration === "repeating" ? coupon.duration_in_months : null,
      };
    }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 503;
    return NextResponse.json({ error: status === 503 ? "Stripe coupon management is unavailable." : message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    await requireSuperUser();
    const body = await request.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const percentOff = Number(body.percentOff);
    const duration = body.duration;
    const durationInMonths = Number(body.durationInMonths);
    const maxRedemptions = body.maxRedemptions === "" || body.maxRedemptions == null ? undefined : Number(body.maxRedemptions);
    const expiresAt = body.expiresAt ? Math.floor(new Date(String(body.expiresAt)).getTime() / 1000) : undefined;

    if (!/^[A-Z0-9-]{4,32}$/.test(code)) return NextResponse.json({ error: "Use 4–32 letters, numbers, or hyphens for the code." }, { status: 400 });
    if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) return NextResponse.json({ error: "Discount must be a whole percentage from 1 to 100." }, { status: 400 });
    if (duration !== "once" && duration !== "repeating" && duration !== "forever") return NextResponse.json({ error: "Choose a valid coupon duration." }, { status: 400 });
    if (duration === "repeating" && (!Number.isInteger(durationInMonths) || durationInMonths < 1 || durationInMonths > 24)) return NextResponse.json({ error: "Repeating discounts must last 1–24 months." }, { status: 400 });
    if (maxRedemptions !== undefined && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) return NextResponse.json({ error: "Maximum redemptions must be a positive whole number." }, { status: 400 });
    if (expiresAt !== undefined && (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000))) return NextResponse.json({ error: "Expiration must be a future date." }, { status: 400 });

    const stripe = getStripe();
    const coupon = await stripe.coupons.create({ percent_off: percentOff, duration, duration_in_months: duration === "repeating" ? durationInMonths : undefined, name: code });
    try {
      const promotion = await stripe.promotionCodes.create({ promotion: { type: "coupon", coupon: coupon.id }, code, max_redemptions: maxRedemptions, expires_at: expiresAt, restrictions: { first_time_transaction: true } });
      return NextResponse.json({ id: promotion.id, code: promotion.code }, { status: 201 });
    } catch (error) {
      await stripe.coupons.del(coupon.id).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 503;
    return NextResponse.json({ error: status === 503 ? "Unable to create that coupon code. Check that the code is unique and try again." : message }, { status });
  }
}
