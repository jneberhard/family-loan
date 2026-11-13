import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { writeAudit } from "@/lib/audit";
import { getFamilyLimits } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const ipLimit = await checkRateLimit({ scope: "family-account-create-ip", identity: getClientIp(request), limit: 30, windowMs: 60 * 60 * 1000 });
    const adminLimit = await checkRateLimit({ scope: "family-account-create-admin", identity: session.userId, limit: 20, windowMs: 60 * 60 * 1000 });
    if (!ipLimit.allowed || !adminLimit.allowed) {
      return rateLimitResponse(Math.max(!ipLimit.allowed ? ipLimit.retryAfterSeconds : 0, !adminLimit.allowed ? adminLimit.retryAfterSeconds : 0));
    }
    const body = await request.json();
    const { name, email, relationship = "Child", annualRate, temporaryPassword } = body;
    if (!name || !email || annualRate === undefined || !temporaryPassword) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (String(temporaryPassword).length < 12) {
      return NextResponse.json({ error: "Temporary password must be at least 12 characters." }, { status: 400 });
    }
    const rate = Number(annualRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return NextResponse.json({ error: "Enter an annual rate between 0 and 100." }, { status: 400 });
    }

    const account = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Family" WHERE "id" = ${session.familyId} FOR UPDATE`;
      const family = await tx.family.findUnique({ where: { id: session.familyId }, select: { plan: true, billingStatus: true, subscriptionPeriodEnd: true } });
      if (family) {
        const { maxChildAccounts } = getFamilyLimits(family);
        const existingChildren = await tx.loanAccount.count({ where: { familyId: session.familyId, deletedAt: null } });
        if (maxChildAccounts !== null && existingChildren >= maxChildAccounts) {
          throw new Error(maxChildAccounts === 1 ? "FREE_CHILD_LIMIT" : "PAID_CHILD_LIMIT");
        }
      }
      const user = await tx.user.create({
        data: {
          name,
          email: String(email).toLowerCase().trim(),
          passwordHash: await bcrypt.hash(String(temporaryPassword), 12),
          role: "CHILD",
          familyId: session.familyId,
          mustChangePassword: true,
        },
      });
      const created = await tx.loanAccount.create({
        data: {
          name,
          email: String(email).toLowerCase().trim(),
          relationship,
          annualRate: rate,
          familyId: session.familyId,
          childUserId: user.id,
        },
      });
      await writeAudit(tx, {
        action: "CHILD_ACCOUNT_CREATED",
        actorId: session.userId,
        familyId: session.familyId,
        accountId: created.id,
        entityType: "LoanAccount",
        entityId: created.id,
        after: { name: created.name, email: created.email, annualRate: created.annualRate },
      });
      return created;
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "FREE_CHILD_LIMIT") return NextResponse.json({ error: "The free plan includes one child account. Upgrade the family plan to add more." }, { status: 402 });
    if (message === "PAID_CHILD_LIMIT") return NextResponse.json({ error: "The family plan includes up to 10 child loan accounts. Remove an account before adding another." }, { status: 409 });
    const status = message === "FORBIDDEN" ? 403 : message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 500 ? "Unable to create account." : message }, { status });
  }
}
