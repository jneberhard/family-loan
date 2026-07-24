import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Session = {
  userId: string;
  familyId?: string;
  role: "SUPER_USER" | "ADMIN" | "CHILD";
  accountId?: string;
  name: string;
};

const cookieName = "family-loan-session";

function key() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }
  return new TextEncoder().encode(value ?? "development-only-session-secret-change-me");
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());

  const store = await cookies();
  store.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload as Session;
  } catch {
    return null;
  }
}

export async function clearSession() {
  (await cookies()).delete(cookieName);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "ADMIN" || !session.familyId) throw new Error("FORBIDDEN");
  return session as Session & { familyId: string; role: "ADMIN" };
}

export async function requireSuperUser() {
  const session = await requireSession();
  if (session.role !== "SUPER_USER") throw new Error("FORBIDDEN");
  return session as Session & { role: "SUPER_USER" };
}
