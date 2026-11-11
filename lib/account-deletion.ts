import { Prisma, type User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { writeAudit } from "@/lib/audit";

type Tx = Prisma.TransactionClient;

function replaceSensitiveText(value: string, name: string, emails: string[]) {
  let result = value;
  for (const [needle, replacement] of [
    ...emails.map((email) => [email, ""] as const),
    [name, "Former family member"] as const,
  ]) {
    if (!needle) continue;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "gi"), replacement);
  }
  return result;
}

function scrubJson(
  value: Prisma.JsonValue | null,
  name: string,
  emails: string[],
  userId: string,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null) return Prisma.JsonNull;
  if (typeof value === "string") return value === userId ? "" : replaceSensitiveText(value, name, emails);
  if (Array.isArray(value)) return value.map((item) => scrubJson(item, name, emails, userId) as Prisma.InputJsonValue);
  if (typeof value === "object") {
    const clean: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      if (key.toLowerCase().endsWith("userid") && item === userId) clean[key] = "";
      else if (typeof item === "string") clean[key] = replaceSensitiveText(item, name, emails);
      else clean[key] = scrubJson(item, name, emails, userId) as Prisma.InputJsonValue;
    }
    return clean;
  }
  return value as Prisma.InputJsonValue;
}

export async function anonymizeAccount(tx: Tx, userId: string, requestedEmail?: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, include: { childAccount: true } });
  if (!user || (user.deletedAt && !requestedEmail)) return { ok: false as const, error: "ACCOUNT_NOT_FOUND" as const };

  if (user.role === "ADMIN" && user.familyId && !user.deletedAt) {
    const adminCount = await tx.user.count({
      where: { familyId: user.familyId, role: "ADMIN", deletedAt: null },
    });
    if (adminCount <= 1) return { ok: false as const, error: "LAST_FAMILY_ADMIN" as const };
  }

  const account = user.childAccount;
  const deletedAt = new Date();
  const oldName = user.name;
  const oldEmails = [user.email, requestedEmail].filter((email): email is string => Boolean(email));
  const anonymizedEmail = `deleted+${randomUUID()}@deleted.kinledger.invalid`;
  const familyId = user.familyId;

  if (account) {
    await tx.loanAccount.update({
      where: { id: account.id },
      data: {
        name: "Former family member",
        email: `former+${randomUUID()}@deleted.kinledger.invalid`,
        relationship: "Former family member",
        childUserId: null,
        balanceReminderDay: null,
        lastBalanceReminderAt: null,
      },
    });
  }

  if (familyId) {
    const matchingAccounts = await tx.loanAccount.findMany({
      where: {
        familyId,
        id: account ? { not: account.id } : undefined,
        OR: [
          ...oldEmails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
          { name: { equals: oldName, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
    });
    for (const matchingAccount of matchingAccounts) {
      const emailMatches = oldEmails.some((email) => matchingAccount.email.toLowerCase() === email.toLowerCase());
      const nameMatches = matchingAccount.name.toLowerCase() === oldName.toLowerCase();
      await tx.loanAccount.update({
        where: { id: matchingAccount.id },
        data: {
          ...(emailMatches ? {
            email: `former+${randomUUID()}@deleted.kinledger.invalid`,
            balanceReminderDay: null,
            lastBalanceReminderAt: null,
          } : {}),
          ...(nameMatches ? { name: "Former family member" } : {}),
        },
      });
    }
  }

  const ledgerEntries = await tx.ledgerEntry.findMany({
    where: account
      ? { accountId: account.id }
      : familyId
        ? { account: { familyId } }
        : { accountId: "__none__" },
    select: { id: true, description: true },
  });
  for (const entry of ledgerEntries) {
    const description = replaceSensitiveText(entry.description, oldName, oldEmails);
    if (description !== entry.description) {
      await tx.ledgerEntry.update({ where: { id: entry.id }, data: { description } });
    }
  }

  await tx.user.update({
    where: { id: user.id },
    data: {
      name: "Deleted account",
      email: anonymizedEmail,
      passwordHash: "ACCOUNT_DELETED",
      mfaSecret: null,
      mfaEnabledAt: null,
      mfaRecoveryCodes: [],
      familyId: null,
      deletedAt,
      sessionVersion: { increment: 1 },
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  await tx.mobileSession.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: deletedAt },
  });

  const auditLogs = await tx.auditLog.findMany({
    where: {
      OR: [
        { actorId: user.id },
        { entityId: user.id },
        ...(familyId ? [{ familyId }] : []),
        ...(account ? [{ accountId: account.id }] : []),
      ],
    },
    select: { id: true, actorId: true, entityId: true, before: true, after: true },
  });
  for (const log of auditLogs) {
    const before = log.before === null ? null : scrubJson(log.before, oldName, oldEmails, user.id);
    const after = log.after === null ? null : scrubJson(log.after, oldName, oldEmails, user.id);
    const beforeChanged = log.before !== null && JSON.stringify(before) !== JSON.stringify(log.before);
    const afterChanged = log.after !== null && JSON.stringify(after) !== JSON.stringify(log.after);
    if (log.actorId !== user.id && log.entityId !== user.id && !beforeChanged && !afterChanged) continue;
    await tx.auditLog.update({
      where: { id: log.id },
      data: {
        actorId: log.actorId === user.id ? null : undefined,
        entityId: log.entityId === user.id ? null : undefined,
        before: before ?? undefined,
        after: after ?? undefined,
      },
    });
  }

  await writeAudit(tx, {
    action: "ACCOUNT_DELETED",
    familyId: familyId ?? undefined,
    accountId: account?.id,
    entityType: "User",
    after: { role: user.role, sharedLedgerRetained: Boolean(account) },
  });

  return { ok: true as const, user, deletedAt };
}

export async function anonymizeUnlinkedAccount(tx: Tx, accountId: string, requestedName: string, requestedEmail: string) {
  const account = await tx.loanAccount.findUnique({ where: { id: accountId } });
  if (!account) return false;
  const name = requestedName || account.name;
  const emails = [requestedEmail, account.email].filter(Boolean);
  await tx.loanAccount.update({
    where: { id: account.id },
    data: {
      name: "Former family member",
      relationship: "Former family member",
      email: `former+${randomUUID()}@deleted.kinledger.invalid`,
      childUserId: null,
      balanceReminderDay: null,
      lastBalanceReminderAt: null,
    },
  });
  const entries = await tx.ledgerEntry.findMany({ where: { accountId }, select: { id: true, description: true } });
  for (const entry of entries) {
    const description = replaceSensitiveText(entry.description, name, emails);
    if (description !== entry.description) await tx.ledgerEntry.update({ where: { id: entry.id }, data: { description } });
  }
  const auditLogs = await tx.auditLog.findMany({ where: { accountId }, select: { id: true, before: true, after: true } });
  for (const log of auditLogs) {
    await tx.auditLog.update({
      where: { id: log.id },
      data: {
        before: scrubJson(log.before, name, emails, ""),
        after: scrubJson(log.after, name, emails, ""),
      },
    });
  }
  await writeAudit(tx, {
    action: "ACCOUNT_DATA_ANONYMIZED",
    familyId: account.familyId,
    accountId: account.id,
    entityType: "LoanAccount",
    entityId: account.id,
    after: { sharedLedgerRetained: true },
  });
  return true;
}

export async function createDeletionRequest(
  tx: Tx,
  user: Pick<User, "id" | "name" | "email" | "role" | "familyId">,
  source: "IN_APP" | "WEB",
  status: "PENDING" | "COMPLETED" = "PENDING",
) {
  return tx.accountDeletionRequest.create({
    data: {
      requesterId: status === "COMPLETED" ? null : user.id,
      familyId: status === "COMPLETED" ? null : user.familyId,
      name: status === "COMPLETED" ? "Deleted account" : user.name,
      email: status === "COMPLETED" ? `deleted+${randomUUID()}@deleted.kinledger.invalid` : user.email,
      role: user.role,
      source,
      status,
      resolvedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
}

export async function notifyDeletionRequest(request: {
  id: string;
  name: string;
  email: string;
  role: string;
  source: string;
  status: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Family Loan Ledger <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO_EMAIL ?? "jreberhard3@gmail.com"],
      subject: `[Family Loan Ledger] Account deletion ${request.status.toLowerCase()}`,
      text: [
        `Request ID: ${request.id}`,
        "Personal details are available in the authorized super-user console.",
        `Source: ${request.source}`,
        `Status: ${request.status}`,
        "",
        "Review this request in the Family Loan Ledger super-user console.",
      ].join("\n"),
    });
    if (error) console.error("Resend deletion notice failed:", error.name);
  } catch (error) {
    console.error("Resend deletion notice failed:", error instanceof Error ? error.name : "unknown error");
  }
}

export async function deleteRequestRecordPii(tx: Tx, requestId: string) {
  const updated = await tx.accountDeletionRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: {
      requesterId: null,
      familyId: null,
      accountId: null,
      name: "Deleted account",
      email: `deleted-request+${requestId}@deleted.kinledger.invalid`,
      resolvedAt: new Date(),
      status: "COMPLETED",
    },
  });
  if (updated.count !== 1) throw new Error("REQUEST_NOT_PENDING");
  return tx.accountDeletionRequest.findUniqueOrThrow({ where: { id: requestId } });
}
