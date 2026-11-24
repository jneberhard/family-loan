import { privatePageRobots } from "@/lib/seo";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { MfaGate } from "@/components/mfa-gate";
import { InactivityTimeout } from "@/components/inactivity-timeout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure super-user sign-in", robots: privatePageRobots };

export default async function MfaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "SUPER_USER") redirect("/dashboard");
  if (session.mustChangePassword) redirect("/change-password");
  if (session.mfaVerified) redirect("/super-admin");

  return (
    <InactivityTimeout>
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <Image src="/family-loan-ledger-logo.png" alt="Family Loan Ledger" width={96} height={96} priority />
          <span className="section-kicker light">Protect account approvals</span>
          <p className="login-story-heading">A second sign-in step protects the Family Loan Ledger administrator account.</p>
        </div>
      </section>
      <section id="main-content" tabIndex={-1} className="login-panel">
        <div className="login-card">
          <div className="brand login-brand">
            <Image src="/family-loan-ledger-logo.png" alt="" width={42} height={42} />
            <span>Family Loan Ledger</span>
          </div>
          <h1>Secure your account</h1>
          <p>Use an authenticator app to verify super-user sign-ins.</p>
          <MfaGate />
        </div>
      </section>
    </main>
    </InactivityTimeout>
  );
}
