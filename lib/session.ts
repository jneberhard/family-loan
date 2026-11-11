import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type Session = {
  userId: string;
  familyId?: string;
  role: "SUPER_USER" | "ADMIN" | "CHILD";
  accountId?: string;
  name: string;
  sessionVersion: number;
  mustChangePassword: boolean;
  mfaVerified?: boolean;
};

const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-family-loan-session-v2"
    : "family-loan-session-v2";
const sessionCookieNames = [
  "family-loan-session-v2",
  "__Host-family-loan-session-v2",
] as const;

function key() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return new TextEncoder().encode(value ?? "development-only-session-secret-change-me");
}

export async function createSessionToken(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key());
}

export async function createMobileSessionToken(session: Session) {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const retentionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await prisma.mobileSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: retentionCutoff } },
        { revokedAt: { lt: retentionCutoff } },
      ],
    },
  });
  await prisma.mobileSession.create({ data: { id, userId: session.userId, expiresAt } });
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setJti(id)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(key());
}

export async function createSession(session: Session) {
  const token = await createSessionToken(session);
  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const authorization = (await headers()).get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken ?? (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.userId !== "string" || typeof payload.sessionVersion !== "number") return null;
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        role: true,
        familyId: true,
        sessionVersion: true,
        mustChangePassword: true,
        deletedAt: true,
        family: { select: { approvalStatus: true } },
        childAccount: { select: { id: true } },
      },
    });
    if (!user || user.deletedAt || user.sessionVersion !== payload.sessionVersion || user.role !== payload.role) return null;
    if (user.role !== "SUPER_USER" && user.family?.approvalStatus !== "APPROVED") return null;
    if (bearerToken) {
      if (typeof payload.jti !== "string") return null;
      const mobileSession = await prisma.mobileSession.findFirst({
        where: {
          id: payload.jti,
          userId: user.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      if (!mobileSession) return null;
    }
    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      familyId: user.familyId ?? undefined,
      accountId: user.childAccount?.id,
      sessionVersion: user.sessionVersion,
      mustChangePassword: user.mustChangePassword,
      mfaVerified: payload.mfaVerified === true,
    };
  } catch {
    return null;
  }
}

export async function revokeBearerSession(request: Request) {
  const bearerToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearerToken) return false;
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(bearerToken, key()));
  } catch {
    return false;
  }
  if (typeof payload.jti !== "string" || typeof payload.userId !== "string") return false;
  const result = await prisma.mobileSession.updateMany({
    where: { id: payload.jti, userId: payload.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}

export async function clearSession() {
  const store = await cookies();
  sessionCookieNames.forEach((name) => store.delete(name));
}

export function expireSessionCookies(response: NextResponse) {
  sessionCookieNames.forEach((name) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Host-"),
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.mustChangePassword || session.role !== "ADMIN" || !session.familyId) {
    throw new Error("FORBIDDEN");
  }
  return session as Session & { familyId: string; role: "ADMIN" };
}

export async function requireSuperUser() {
  const session = await requireSession();
  if (session.mustChangePassword || session.role !== "SUPER_USER" || !session.mfaVerified) throw new Error("FORBIDDEN");
  return session as Session & { role: "SUPER_USER" };
}
