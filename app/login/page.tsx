import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-story">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="login-story-inner">
          <Image src="/kinledger-logo.png" alt="KinLedger" width={96} height={96} priority />
          <span className="section-kicker light">A family record you can trust</span>
          <h1>Money conversations feel better when the numbers are clear.</h1>
          <ul>
            <li><CheckCircle2 /> Private family workspace</li>
            <li><CheckCircle2 /> Parent-managed loan records</li>
            <li><CheckCircle2 /> Read-only access for children</li>
          </ul>
        </div>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="brand login-brand">
            <Image src="/kinledger-logo.png" alt="" width={42} height={42} />
            <span>KinLedger</span>
          </div>
          <span className="login-icon"><LockKeyhole size={22} /></span>
          <h2>Welcome back</h2>
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
