import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SUPER_USER_NAME?.trim() || "KinLedger Administrator";
  const email = process.env.SUPER_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_USER_PASSWORD ?? "";

  if (!email || !email.includes("@")) {
    throw new Error("Set SUPER_USER_EMAIL to a valid email address.");
  }
  if (password.length < 16) {
    throw new Error("SUPER_USER_PASSWORD must contain at least 16 characters.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== "SUPER_USER") {
    throw new Error("That email already belongs to a parent or child account.");
  }

  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: { name, passwordHash: await bcrypt.hash(password, 12) },
      })
    : await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await bcrypt.hash(password, 12),
          role: "SUPER_USER",
        },
      });

  console.log(`Super user ready: ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
