import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { newTotpSecret } from "@/lib/mfa";

export async function POST() {
  try {
    const session = await requireSession();
    if (session.role !== "SUPER_USER" || session.mustChangePassword) {
      return NextResponse.json({ error: "Super-user authentication is required." }, { status: 403 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { mfaEnabledAt: true },
    });
    if (!user || user.mfaEnabledAt) {
      return NextResponse.json({ error: "MFA is already enabled for this account." }, { status: 409 });
    }
    const secret = newTotpSecret();
    return NextResponse.json(
      { secret },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json(
      { error: status === 401 ? "Sign in again." : "Unable to start authenticator setup." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
