import Image from "next/image";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <Image src="/kinledger-logo.png" alt="KinLedger" width={96} height={96} priority />
          <span className="section-kicker light">Protect your family records</span>
          <h1>A strong, private password is the first line of defense.</h1>
          <p>Changing it also signs out any other browser sessions for this account.</p>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="brand login-brand">
            <Image src="/kinledger-logo.png" alt="" width={42} height={42} />
            <span>KinLedger</span>
          </div>
          <span className="login-icon"><KeyRound size={22} /></span>
          <h2>{session.mustChangePassword ? "Create your private password" : "Change your password"}</h2>
          <p>
            {session.mustChangePassword
              ? "Your temporary password must be replaced before you continue."
              : "Enter your current password, then choose a new one."}
          </p>
          <ChangePasswordForm />
        </div>
      </section>
    </main>
  );
}
