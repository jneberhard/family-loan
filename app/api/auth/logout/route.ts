import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST(request: Request) {
  await clearSession();
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }
  return NextResponse.json({ ok: true });
}
