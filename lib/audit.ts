import { Prisma } from "@prisma/client";

type AuditInput = {
  action: string;
  actorId?: string;
  familyId?: string;
  accountId?: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
};

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId,
      familyId: input.familyId,
      accountId: input.accountId,
      entityType: input.entityType,
      entityId: input.entityId,
      before: jsonValue(input.before),
      after: jsonValue(input.after),
    },
  });
}
