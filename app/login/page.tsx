import { publicPageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export const metadata = { ...publicPageMetadata("/login", "Sign in", "Sign in to your private Family Loan Ledger workspace to review loan balances, payments, and interest."), robots: { index: false, follow: true } };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-story">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="login-story-inner">
          <Image src="/family-loan-ledger-logo.png" alt="Family Loan Ledger" width={96} height={96} priority />
          <span className="section-kicker light">A family record you can trust</span>
          <p className="login-story-heading">Money conversations feel better when the numbers are clear.</p>
          <ul>
            <li><CheckCircle2 /> Private family workspace</li>
            <li><CheckCircle2 /> Parent-managed loan records</li>
            <li><CheckCircle2 /> Read-only access for children</li>
          </ul>
        </div>
      </section>
      <section id="main-content" tabIndex={-1} className="login-panel">
        <div className="login-card">
          <div className="brand login-brand">
            <Image src="/family-loan-ledger-logo.png" alt="" width={42} height={42} />
            <span>Family Loan Ledger</span>
          </div>
          <span className="login-icon"><LockKeyhole size={22} /></span>
          <h1>Welcome back</h1>
          <p>Sign in to your private family ledger.</p>
          <LoginForm />
          <Link href="/become-parent" className="button button-soft button-large login-signup">
            Become a parent lender
          </Link>
          <div className="demo-callout">
            <span>Just looking around?</span>
            <Link href="/demo">Open the interactive demo →</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
