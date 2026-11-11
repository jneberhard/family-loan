import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const familyName = String(body.familyName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const interestPostingDay = Number(body.interestPostingDay ?? 1);
    const legalAcknowledgment = body.legalAcknowledgment === true;

    if (!name || !familyName || !email || !password) {
      return NextResponse.json({ error: "All required fields must be completed." }, { status: 400 });
    }
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: "Password must be at least 12 characters." }, { status: 400 });
    }
    if (!legalAcknowledgment) {
      return NextResponse.json(
        { error: "You must acknowledge the Legal & Loan Disclaimer." },
        { status: 400 },
      );
    }
    const ipLimit = await checkRateLimit({
      scope: "parent-registration-ip",
      identity: getClientIp(request),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    const emailLimit = await checkRateLimit({
      scope: "parent-registration-email",
      identity: email,
      limit: 3,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return rateLimitResponse(Math.max(
        !ipLimit.allowed ? ipLimit.retryAfterSeconds : 0,
        !emailLimit.allowed ? emailLimit.retryAfterSeconds : 0,
      ));
    }
    if (!Number.isInteger(interestPostingDay) || interestPostingDay < 1 || interestPostingDay > 28) {
      return NextResponse.json({ error: "Interest posting day must be between 1 and 28." }, { status: 400 });
    }

    const family = await prisma.family.create({
      data: {
        name: familyName,
        interestPostingDay,
        approvalStatus: "PENDING",
        users: {
          create: {
            name,
            email,
            passwordHash: await bcrypt.hash(password, 12),
            role: "ADMIN",
          },
        },
      },
      select: { id: true, name: true, approvalStatus: true },
    });

    return NextResponse.json(
      {
        applicationId: family.id,
        familyName: family.name,
        status: family.approvalStatus,
        message: "Your application was submitted for super-user approval.",
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to submit the application right now." }, { status: 500 });
  }
}
