import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { ParentRegistrationForm } from "@/components/parent-registration-form";

export const metadata = {
  title: "Become a parent lender",
  description: "Apply for a private Family Loan Ledger parent-lender workspace.",
};

export default async function BecomeParentPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planParam } = await searchParams;
  const initialPlan = planParam === "MONTHLY" || planParam === "YEARLY" ? planParam : "FREE";
  return (
    <main className="login-page registration-page">
      <section className="login-story">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="login-story-inner">
          <Image src="/family-loan-ledger-logo.png" alt="Family Loan Ledger" width={96} height={96} priority />
          <span className="section-kicker light">Become a parent lender</span>
          <h1>Create a clear, private place for every family loan.</h1>
          <ul>
            <li><CheckCircle2 /> Free access starts as soon as you sign up</li>
            <li><CheckCircle2 /> You control loans, payments, and interest</li>
            <li><CheckCircle2 /> Each child receives a private read-only account</li>
          </ul>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card registration-card">
          <div className="brand login-brand">
            <Image src="/family-loan-ledger-logo.png" alt="" width={42} height={42} />
            <span>Family Loan Ledger</span>
          </div>
          <span className="login-icon"><ShieldCheck size={22} /></span>
          <h2>Create your family workspace</h2>
          <p>Tell us who will manage your family’s loan workspace.</p>
          <ParentRegistrationForm initialPlan={initialPlan} />
          <div className="demo-callout">
            <span>Already approved?</span>
            <Link href="/login">Sign in →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
