import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AccountDeletionForm } from "@/components/account-deletion-form";

export const metadata = {
  title: "Request account deletion",
  description: "Request deletion of your Family Loan Ledger account and personal information.",
};

export default function DeleteAccountPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-card">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="brand privacy-brand">
          <Image src="/family-loan-ledger-logo.png" alt="" width={48} height={48} />
          <span>Family Loan Ledger</span>
        </div>
        <span className="privacy-icon"><ShieldCheck size={22} /></span>
        <h1>Request account deletion</h1>
        <p>Use this form if you can’t sign in to Family Loan Ledger. We’ll verify that you control the account before completing the request.</p>
        <section>
          <h2>What happens to family records</h2>
          <p>We remove your account’s identifying details and sign-in access. Shared family loan entries remain available to the family, with your account identity anonymized. If you are the only family administrator, we’ll contact you to arrange continued family access before completing deletion.</p>
        </section>
        <AccountDeletionForm />
        <section>
          <p>Already signed in? Submit a deletion request from the app’s Account &amp; privacy screen. See the <Link href="/privacy">Privacy notice</Link>.</p>
        </section>
      </article>
    </main>
  );
}
