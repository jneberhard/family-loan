import { NextResponse } from "next/server";
import { anonymizeAccount, anonymizeUnlinkedAccount, deleteRequestRecordPii } from "@/lib/account-deletion";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireSuperUser } from "@/lib/session";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperUser();
    const { id } = await context.params;
    const body = await request.json();
    if (body.status !== "COMPLETED") {
      return NextResponse.json({ error: "Only completed deletion requests can be finalized." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const deletionRequest = await tx.accountDeletionRequest.findUnique({ where: { id } });
      if (!deletionRequest) throw new Error("REQUEST_NOT_FOUND");
      if (deletionRequest.status === "COMPLETED") return deletionRequest;
      if (deletionRequest.status !== "PENDING") throw new Error("REQUEST_NOT_PENDING");

      const user = deletionRequest.requesterId
        ? await tx.user.findFirst({
            where: { id: deletionRequest.requesterId, role: { in: ["ADMIN", "CHILD"] } },
            select: { id: true },
          })
        : await tx.user.findFirst({
            where: { email: deletionRequest.email, deletedAt: null, role: { in: ["ADMIN", "CHILD"] } },
            select: { id: true },
          });

      if (user) {
        const anonymized = await anonymizeAccount(tx, user.id, deletionRequest.email);
        if (!anonymized.ok && anonymized.error === "LAST_FAMILY_ADMIN") throw new Error("LAST_FAMILY_ADMIN");
        if (!anonymized.ok) throw new Error("ACCOUNT_NOT_FOUND");
      } else if (deletionRequest.accountId) {
        const anonymized = await anonymizeUnlinkedAccount(
          tx,
          deletionRequest.accountId,
          deletionRequest.name,
          deletionRequest.email,
        );
        if (!anonymized) throw new Error("ACCOUNT_NOT_FOUND");
      }

      const completed = await deleteRequestRecordPii(tx, id);
      await writeAudit(tx, {
        action: "ACCOUNT_DELETION_FULFILLED",
        actorId: session.userId,
        familyId: deletionRequest.familyId ?? undefined,
        entityType: "AccountDeletionRequest",
        entityId: id,
        after: { source: deletionRequest.source },
      });
      return completed;
    });

    return NextResponse.json({ id: result.id, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "UNAUTHORIZED" ? 401 :
      message === "FORBIDDEN" ? 403 :
      message === "REQUEST_NOT_FOUND" || message === "ACCOUNT_NOT_FOUND" ? 404 :
      message === "REQUEST_NOT_PENDING" ? 409 :
      message === "LAST_FAMILY_ADMIN" ? 409 : 500;
    return NextResponse.json(
      { error: status === 500 ? "Unable to complete this deletion request." : message },
      { status },
    );
  }
}
