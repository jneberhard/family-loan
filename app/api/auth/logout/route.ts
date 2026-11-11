import { NextResponse } from "next/server";
import { expireSessionCookies, revokeBearerSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    await revokeBearerSession(request);
  } catch {
    return NextResponse.json(
      { error: "Unable to revoke this mobile session. Try again when the connection is restored." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = request.headers.get("accept")?.includes("text/html")
    ? NextResponse.redirect(new URL("/login", request.url), 303)
    : NextResponse.json({ ok: true });

  expireSessionCookies(response);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
