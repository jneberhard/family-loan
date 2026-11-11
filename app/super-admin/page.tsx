import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { SuperAdminDashboard } from "@/components/super-admin-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Super user console" };

export default async function SuperAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  if (session.role !== "SUPER_USER") redirect("/dashboard");
  if (!session.mfaVerified) redirect("/mfa");

  const families = await prisma.family.findMany({
    include: {
      users: { where: { role: "ADMIN", deletedAt: null }, select: { name: true, email: true } },
      _count: { select: { accounts: { where: { deletedAt: null } } } },
    },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
  });
  const deletionRequests = await prisma.accountDeletionRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, source: true, createdAt: true },
  });

  return (
    <SuperAdminDashboard
      initialApplications={families.map((family) => ({
        id: family.id,
        familyName: family.name,
        parentName: family.users[0]?.name ?? "Unknown parent",
        email: family.users[0]?.email ?? "No email",
        createdAt: family.createdAt.toISOString(),
        status: family.approvalStatus,
        childCount: family._count.accounts,
        reviewNote: family.reviewNote,
      }))}
      initialDeletionRequests={deletionRequests.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
    />
  );
}
