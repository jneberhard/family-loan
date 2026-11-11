import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

const DEVELOPMENT_KEY = "kinledger-development-rate-limit-key-change-before-production";

function hashIdentity(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required for rate limiting in production.");
  }
  return createHmac("sha256", secret ?? DEVELOPMENT_KEY).update(value).digest("hex");
}

export function getClientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export async function checkRateLimit(input: {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
}) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - input.windowMs);
  const key = hashIdentity(`${input.scope}:${input.identity}`);
  const rows = await prisma.$queryRaw<Array<{ count: number; windowStartedAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "windowStartedAt", "count", "createdAt", "updatedAt")
    VALUES (${key}, ${now}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStartedAt" <= ${cutoff} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "RateLimitBucket"."windowStartedAt" <= ${cutoff} THEN ${now}
        ELSE "RateLimitBucket"."windowStartedAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "windowStartedAt"
  `;

  if (Math.random() < 0.01) {
    await prisma.rateLimitBucket.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } });
  }

  const bucket = rows[0];
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((bucket.windowStartedAt.getTime() + input.windowMs - now.getTime()) / 1000),
  );
  return {
    allowed: bucket.count <= input.limit,
    retryAfterSeconds,
  };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many attempts. Please wait before trying again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}
