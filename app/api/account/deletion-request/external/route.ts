import { NextResponse } from "next/server";
import { notifyDeletionRequest } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit({ scope: "external-deletion-request-ip", identity: getClientIp(request), limit: 4, windowMs: 60 * 60 * 1000 });
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

    const body = await request.json();
    if (String(body.website ?? "").trim()) return NextResponse.json({ ok: true });
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!name || name.length > 100) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const existing = await prisma.accountDeletionRequest.findFirst({
      where: { email, status: "PENDING" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "Your request was received. Family Loan Ledger will verify the account and follow up before completing deletion.",
      }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null, role: { in: ["ADMIN", "CHILD"] } },
      select: { id: true, name: true, email: true, role: true, familyId: true, childAccount: { select: { id: true } } },
    });
    const familyAccount = await prisma.loanAccount.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, familyId: true, childUserId: true },
    });
    const deletion = await prisma.accountDeletionRequest.create({
      data: {
        requesterId: user?.id ?? familyAccount?.childUserId ?? null,
        familyId: user?.familyId ?? familyAccount?.familyId ?? null,
        accountId: user?.childAccount?.id ?? familyAccount?.id ?? null,
        name,
        email,
        role: user?.role ?? "CHILD",
        source: "WEB",
      },
    });
    await notifyDeletionRequest({ ...deletion, status: deletion.status });
    return NextResponse.json({
      ok: true,
      message: "Your request was received. Family Loan Ledger will verify the account and follow up before completing deletion.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to submit the request right now. Please try again." }, { status: 500 });
  }
}
