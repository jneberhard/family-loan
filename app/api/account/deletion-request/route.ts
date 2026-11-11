import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { anonymizeAccount, createDeletionRequest, notifyDeletionRequest } from "@/lib/account-deletion";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireSession();
    const requests = await prisma.accountDeletionRequest.findMany({
      where: { requesterId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });
    return NextResponse.json({ requests }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? message : "Unable to load deletion requests." }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (session.mustChangePassword || session.role === "SUPER_USER") {
      return NextResponse.json({ error: "This account cannot request deletion here." }, { status: 403 });
    }

    const body = await request.json();
    if (typeof body.password !== "string" || !body.password) {
      return NextResponse.json({ error: "Enter your password to confirm the request." }, { status: 400 });
    }
    if (body.confirmation !== "DELETE") {
      return NextResponse.json({ error: "Type DELETE to confirm account deletion." }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { id: session.userId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        familyId: true,
        passwordHash: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });
    if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json({ error: "Too many confirmation attempts. Try again in 15 minutes." }, { status: 429 });
    }
    if (!(await bcrypt.compare(body.password, user.passwordHash))) {
      const attempts = user.failedLoginAttempts + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });
      return NextResponse.json({ error: "Your password is incorrect." }, { status: 401 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });

    const pending = await prisma.accountDeletionRequest.findFirst({
      where: { requesterId: user.id, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      return NextResponse.json({ status: "PENDING", requestId: pending.id, message: "Your deletion request is already under review." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletion = await anonymizeAccount(tx, user.id);
      if (!deletion.ok && deletion.error === "ACCOUNT_NOT_FOUND") throw new Error("ACCOUNT_NOT_FOUND");
      if (!deletion.ok && deletion.error === "LAST_FAMILY_ADMIN") {
        const stored = await createDeletionRequest(tx, user, "IN_APP", "PENDING");
        return { request: stored, pending: true };
      }
      const stored = await createDeletionRequest(tx, user, "IN_APP", "COMPLETED");
      return { request: stored, pending: false };
    });

    if (result.pending) await notifyDeletionRequest(result.request);
    const response = NextResponse.json({
      status: result.pending ? "PENDING" : "COMPLETED",
      requestId: result.request.id,
      message: result.pending
        ? "Your request is queued. Because you are the family's only administrator, Family Loan Ledger will contact you about preserving family access before completing deletion."
        : "Your account was deleted and your family ledger was anonymized and preserved.",
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "UNAUTHORIZED" ? 401 :
      message === "FORBIDDEN" ? 403 :
      message === "ACCOUNT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to process the deletion request." : message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    const pending = await prisma.accountDeletionRequest.findFirst({
      where: { requesterId: session.userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) return NextResponse.json({ error: "No pending deletion request was found." }, { status: 404 });
    const cancelled = await prisma.accountDeletionRequest.updateMany({
      where: { id: pending.id, requesterId: session.userId, status: "PENDING" },
      data: {
        requesterId: null,
        familyId: null,
        accountId: null,
        name: "Cancelled request",
        email: `cancelled-request+${pending.id}@deleted.kinledger.invalid`,
        status: "CANCELLED",
        resolvedAt: new Date(),
      },
    });
    if (cancelled.count !== 1) {
      return NextResponse.json({ error: "The request was already completed or cancelled." }, { status: 409 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? message : "Unable to cancel the request." }, { status });
  }
}
