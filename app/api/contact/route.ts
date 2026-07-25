import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const attempts = new Map<string, { count: number; resetAt: number }>();
const windowMs = 10 * 60 * 1000;
const maxAttempts = 5;

function isRateLimited(ip: string) {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  current.count += 1;
  return current.count > maxAttempts;
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "local";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many messages were submitted. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const subject = String(body.subject ?? "").trim().replace(/[\r\n]+/g, " ");
    const message = String(body.message ?? "").trim();
    const website = String(body.website ?? "").trim();

    if (website) return NextResponse.json({ ok: true });
    if (!name || name.length > 100) {
      return NextResponse.json({ error: "Enter your name." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!subject || subject.length > 120) {
      return NextResponse.json({ error: "Choose a valid subject." }, { status: 400 });
    }
    if (message.length < 20 || message.length > 5000) {
      return NextResponse.json(
        { error: "Your message must contain between 20 and 5,000 characters." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Contact email is not configured yet." },
        { status: 503 },
      );
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "KinLedger <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO_EMAIL ?? "jreberhard3@gmail.com"],
      replyTo: email,
      subject: `[KinLedger contact] ${subject}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Subject: ${subject}`,
        "",
        message,
      ].join("\n"),
    });

    if (error) {
      console.error("Resend contact error:", error.name);
      return NextResponse.json(
        { error: "Your message could not be sent. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Your message could not be sent. Please try again." },
      { status: 500 },
    );
  }
}
