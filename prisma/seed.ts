import { PrismaClient, EntryType, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { demoChildren } from "../lib/demo-data";

const prisma = new PrismaClient();

function assertDemoSeedAllowed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to load demo data in production. Provision the super user with pnpm db:create-super instead.");
  }
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seeding deletes existing data. Set ALLOW_DEMO_SEED=true only for a disposable development database.");
  }
}

async function main() {
  assertDemoSeedAllowed();

  await prisma.auditLog.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.loanAccount.deleteMany();
  await prisma.user.deleteMany();
  await prisma.family.deleteMany();

  const passwordHash = await bcrypt.hash("FamilyDemo2026!", 12);
  await prisma.user.create({
    data: {
      name: "Family Loan Ledger Super User",
      email: "super@demo.family",
      passwordHash,
      role: UserRole.SUPER_USER,
    },
  });

  const family = await prisma.family.create({
    data: {
      name: "Bennett Family",
      interestPostingDay: 5,
      approvalStatus: "APPROVED",
      reviewedAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      name: "James Bennett",
      email: "james@demo.family",
      passwordHash,
      role: UserRole.ADMIN,
      familyId: family.id,
    },
  });

  for (const child of demoChildren) {
    const childUser = await prisma.user.create({
      data: {
        name: child.name,
        email: child.email,
        passwordHash,
        role: UserRole.CHILD,
        familyId: family.id,
      },
    });

    await prisma.loanAccount.create({
      data: {
        name: child.name,
        email: child.email,
        relationship: child.purpose,
        annualRate: child.rate,
        familyId: family.id,
        childUserId: childUser.id,
        transactions: {
          create: child.entries.map((entry) => ({
            type:
              entry.type === "Rate change"
                ? EntryType.RATE_CHANGE
                : (entry.type.toUpperCase() as EntryType),
            effectiveAt: new Date(`${entry.date}T12:00:00Z`),
            description: entry.description,
            amount: entry.amount,
            rate: entry.rate,
          })),
        },
      },
    });
  }

  console.log("Seeded the Bennett family demo.");
  console.log("Super user: super@demo.family / FamilyDemo2026!");
  console.log("Parent: james@demo.family / FamilyDemo2026!");
  console.log("Children: olivia@demo.family, ethan@demo.family, maya@demo.family");
  console.log("Child password: FamilyDemo2026!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
