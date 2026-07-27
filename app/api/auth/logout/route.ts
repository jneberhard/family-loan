import { NextResponse } from "next/server";
import { expireSessionCookies } from "@/lib/session";

export async function POST(request: Request) {
  const response = request.headers.get("accept")?.includes("text/html")
    ? NextResponse.redirect(new URL("/login", request.url), 303)
    : NextResponse.json({ ok: true });

  expireSessionCookies(response);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
