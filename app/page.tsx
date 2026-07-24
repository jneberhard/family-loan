import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav container">
        <Link href="/" className="brand">
          <Image src="/kinledger-logo.png" alt="" width={46} height={46} priority />
          <span>KinLedger</span>
        </Link>
        <div className="landing-nav-actions">
          <Link href="/login" className="button button-ghost">Sign in</Link>
          <Link href="/become-parent" className="button button-primary">Become a parent lender</Link>
        </div>
      </nav>

      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> Family finance, made thoughtful</div>
          <h1>Keep family loans clear.<br /><em>Keep family, family.</em></h1>
          <p>
            A shared ledger for parents who lend and children who want clarity—
            with automatic interest, transparent balances, and respectful boundaries.
          </p>
          <div className="hero-actions">
            <Link href="/become-parent" className="button button-primary button-large">
              Become a parent lender <ArrowRight size={18} />
            </Link>
            <Link href="/demo" className="text-link">Explore the family demo</Link>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> Parent-controlled</span>
            <span><LockKeyhole size={17} /> Read-only child access</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="KinLedger balance preview">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="preview-card">
            <div className="preview-top">
              <div>
                <span className="label">Family portfolio</span>
                <strong>$72,693.60</strong>
              </div>
              <span className="positive-pill">3 active loans</span>
            </div>
            <div className="mini-chart">
              {[32, 45, 39, 54, 63, 58, 76, 70, 85].map((value, index) => (
                <span key={index} style={{ height: `${value}%` }} />
              ))}
            </div>
            <div className="preview-family">
              {[
                ["OB", "Olivia", "$39,075.48"],
                ["EB", "Ethan", "$17,737.41"],
                ["MB", "Maya", "$15,880.46"],
              ].map(([initials, name, balance]) => (
                <div key={name}>
                  <i>{initials}</i><span>{name}</span><strong>{balance}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="interest-float">
            <i><ReceiptText size={19} /></i>
            <span>Next interest posting<strong>August 5</strong></span>
          </div>
        </div>
      </section>

      <section className="promise-band">
        <div className="container promise-grid">
          <div>
            <span className="section-kicker">Made for real families</span>
            <h2>Structure without the awkwardness.</h2>
          </div>
          <p>
            KinLedger gives everyone the same numbers and the right level of access,
            so conversations can focus on progress—not spreadsheets.
          </p>
        </div>
        <div className="container feature-grid">
          <article>
            <i><Landmark size={25} /></i>
            <h3>One family portfolio</h3>
            <p>See every child’s balance, rate, and payment history in one calm dashboard.</p>
          </article>
          <article>
            <i><ReceiptText size={25} /></i>
            <h3>A ledger for every loan</h3>
            <p>Record advances, repayments, adjustments, and itemized interest with a clear audit trail.</p>
          </article>
          <article>
            <i><LockKeyhole size={25} /></i>
            <h3>Boundaries built in</h3>
            <p>Parents manage the books. Each child sees only their own account in a read-only view.</p>
          </article>
        </div>
      </section>

      <section className="cta-section container">
        <Image src="/kinledger-logo.png" alt="" width={88} height={88} />
        <div>
          <span className="section-kicker">Start with confidence</span>
          <h2>A healthier way to lend within the family.</h2>
        </div>
        <Link href="/demo" className="button button-gold button-large">Open the demo <ArrowRight size={18} /></Link>
        <p><Check size={17} /> Includes 8 months of sample history for three child accounts</p>
      </section>

      <footer className="landing-footer container">
        <span>© 2026 KinLedger</span>
        <span>Private by design · Clear by default</span>
      </footer>
    </main>
  );
}
