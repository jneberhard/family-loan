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

  const families = await prisma.family.findMany({
    include: {
      users: { where: { role: "ADMIN" }, select: { name: true, email: true } },
      _count: { select: { accounts: true } },
    },
    orderBy: [{ approvalStatus: "asc" }, { createdAt: "desc" }],
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
    />
  );
}
