import { privatePageRobots } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { InactivityTimeout } from "@/components/inactivity-timeout";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Change password", robots: privatePageRobots };

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <InactivityTimeout>
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <Image src="/family-loan-ledger-logo.png" alt="Family Loan Ledger" width={96} height={96} priority />
          <span className="section-kicker light">Protect your family records</span>
          <p className="login-story-heading">A strong, private password is the first line of defense.</p>
          <p>Changing it also signs out any other browser sessions for this account.</p>
        </div>
      </section>
      <section id="main-content" tabIndex={-1} className="login-panel">
        <div className="login-card">
          <div className="brand login-brand">
            <Image src="/family-loan-ledger-logo.png" alt="" width={42} height={42} />
            <span>Family Loan Ledger</span>
          </div>
          <span className="login-icon"><KeyRound size={22} /></span>
          <h1>{session.mustChangePassword ? "Create your private password" : "Change your password"}</h1>
          <p>
            {session.mustChangePassword
              ? "Your temporary password must be replaced before you continue."
              : "Enter your current password, then choose a new one."}
          </p>
          <ChangePasswordForm />
          {!session.mustChangePassword && (
            <Link href={session.role === "SUPER_USER" ? "/super-admin" : "/dashboard"} className="change-password-back">
              Cancel and return to dashboard
            </Link>
          )}
        </div>
      </section>
    </main>
    </InactivityTimeout>
  );
}
