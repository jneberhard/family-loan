import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await requireSession();
    if (session.role !== "SUPER_USER" || session.mustChangePassword) {
      return NextResponse.json({ error: "Super-user authentication is required." }, { status: 403 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { mfaEnabledAt: true },
    });
    return NextResponse.json(
      { enabled: Boolean(user?.mfaEnabledAt), verified: session.mfaVerified === true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "Sign in again." : "Unable to check MFA status." }, { status });
  }
}
