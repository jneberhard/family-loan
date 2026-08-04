import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calculator,
  HandCoins,
  KeyRound,
  Mail,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "User Guide",
  description: "Learn how to set up and manage a family loan in KinLedger.",
};

const guideSections = [
  ["getting-started", "Getting started"],
  ["dashboard", "Using the dashboard"],
  ["ledger", "Managing the ledger"],
  ["interest", "Interest and APR"],
  ["family-access", "Family access"],
  ["reminders", "Balance emails"],
  ["child-view", "Child experience"],
  ["good-records", "Keeping good records"],
] as const;

export default async function GuidePage() {
  const session = await getSession();
  const returnHref = session
    ? session.mustChangePassword
      ? "/change-password"
      : session.role === "SUPER_USER"
        ? "/super-admin"
        : "/dashboard"
    : "/";

  return (
    <main className="guide-page">
      <nav className="guide-nav container" aria-label="Guide navigation">
        <Link href="/" className="brand">
          <Image src="/kinledger-logo.png" alt="" width={44} height={44} priority />
          <span>KinLedger</span>
        </Link>
        <Link href={returnHref} className="guide-home-link">
          <ArrowLeft size={16} /> {session ? "Back to dashboard" : "Back home"}
        </Link>
      </nav>

      <div className="guide-layout container">
        <aside className="guide-toc">
          <span>In this guide</span>
          <nav aria-label="On this page">
            {guideSections.map(([id, label]) => (
              <a key={id} href={`#${id}`}>{label}</a>
            ))}
          </nav>
          <div className="guide-toc-note">
            <ShieldCheck size={18} />
            <p>Parents manage the books. Children have read-only access to their own account.</p>
          </div>
        </aside>

        <article className="guide-content">
          <header className="guide-hero">
            <span className="guide-icon"><BookOpen size={24} /></span>
            <p className="section-kicker">KinLedger user guide</p>
            <h1>Clear records for every family loan.</h1>
            <p>
              This guide walks parent lenders, co-parents, and children through the
              everyday parts of KinLedger—from creating an account to reviewing a balance.
            </p>
          </header>

          <section id="getting-started" className="guide-section">
            <div className="guide-section-heading">
              <KeyRound size={22} />
              <div>
                <span>01</span>
                <h2>Getting started</h2>
              </div>
            </div>
            <div className="guide-steps">
              <div><b>1</b><p><strong>Create a parent-lender account.</strong> Select <em>Become a parent lender</em>, enter your family workspace and sign-in details, then submit the application.</p></div>
              <div><b>2</b><p><strong>Wait for approval.</strong> KinLedger reviews new parent-lender applications before the workspace can be used.</p></div>
              <div><b>3</b><p><strong>Sign in and add a child.</strong> From the dashboard, choose <em>Add child</em>, then enter the child’s name, email, loan purpose, starting APR, and a temporary password.</p></div>
              <div><b>4</b><p><strong>Share credentials privately.</strong> Give the temporary password directly to the child. They will be asked to replace it when they first sign in.</p></div>
            </div>
            <div className="guide-callout">
              <UserPlus size={21} />
              <p><strong>Want to look around first?</strong> The <Link href="/demo">interactive demo</Link> lets you try parent and child views without creating an account.</p>
            </div>
          </section>

          <section id="dashboard" className="guide-section">
            <div className="guide-section-heading">
              <HandCoins size={22} />
              <div>
                <span>02</span>
                <h2>Using the dashboard</h2>
              </div>
            </div>
            <p>The parent dashboard is your family’s shared financial overview. Select a child in the sidebar to see that account’s current balance, principal, repayments, APR, next interest date, and complete ledger.</p>
            <div className="guide-grid">
              <article><strong>Portfolio summary</strong><p>Shows the combined outstanding balance, total payments, and number of active child accounts.</p></article>
              <article><strong>Child snapshot</strong><p>Shows progress for the selected loan and keeps its most important figures together.</p></article>
              <article><strong>Recent activity</strong><p>Lists each loan, payment, adjustment, and interest posting in date order.</p></article>
              <article><strong>CSV export</strong><p>Use <em>Download full ledger</em> to save the selected account’s transaction history.</p></article>
            </div>
          </section>

          <section id="ledger" className="guide-section">
            <div className="guide-section-heading">
              <ReceiptText size={22} />
              <div>
                <span>03</span>
                <h2>Managing the ledger</h2>
              </div>
            </div>
            <p>Select <em>Add entry</em> on a child account and choose the entry that matches what happened.</p>
            <div className="guide-entry-list">
              <div><span className="entry-dot loan" /><p><strong>Loan</strong> records money advanced to the child and increases the balance.</p></div>
              <div><span className="entry-dot payment" /><p><strong>Payment</strong> records money repaid and reduces the balance.</p></div>
              <div><span className="entry-dot adjustment" /><p><strong>Adjustment</strong> corrects the ledger. A positive adjustment raises the balance; a negative one lowers it, such as for a family gift.</p></div>
              <div><span className="entry-dot interest" /><p><strong>Interest</strong> is created through the interest-calculation flow and increases the balance.</p></div>
            </div>
            <p className="guide-small">Parents and co-parents can edit or remove an entry. KinLedger recalculates the running balance automatically and keeps an audit record of the change.</p>
          </section>

          <section id="interest" className="guide-section">
            <div className="guide-section-heading">
              <Calculator size={22} />
              <div>
                <span>04</span>
                <h2>Interest and APR</h2>
              </div>
            </div>
            <p>Each child account has an annual percentage rate. KinLedger calculates interest using the outstanding balance for each day, so loans, payments, gifts, and rate changes are reflected from their effective dates.</p>
            <div className="guide-formula">
              <span>Daily interest</span>
              <strong>balance × (APR ÷ 100) ÷ 365</strong>
            </div>
            <div className="guide-two-column">
              <div><h3>Post monthly interest</h3><p>Interest posts automatically on the family’s monthly posting day. Parents can open the selected child’s interest action beforehand to preview the exact daily calculation.</p></div>
              <div><h3>Change the APR</h3><p>Choose the rate action, enter the new APR and its effective date, then save. KinLedger preserves the rate history used by the ledger.</p></div>
            </div>
            <div className="guide-callout muted">
              <Settings size={21} />
              <p>The family’s preferred monthly posting day can be changed in <strong>Family settings</strong>. On that day, KinLedger posts calculated interest to every active loan with a positive interest-bearing balance. Duplicate posting is prevented automatically.</p>
            </div>
          </section>

          <section id="family-access" className="guide-section">
            <div className="guide-section-heading">
              <Users size={22} />
              <div>
                <span>05</span>
                <h2>Family access</h2>
              </div>
            </div>
            <div className="guide-role-table">
              <div className="guide-role-header"><span>Role</span><span>What they can do</span></div>
              <div><strong>Parent lender</strong><p>Manage children, entries, APRs, interest, reminders, family settings, and access.</p></div>
              <div><strong>Co-parent</strong><p>Has the same family-administrator permissions as the parent who created the workspace.</p></div>
              <div><strong>Child</strong><p>Can sign in and view only their own balance and ledger. They cannot change financial records.</p></div>
            </div>
            <p>Open <em>Family Access</em> to add a co-parent, review family members, or update and remove access. New co-parents and children receive temporary credentials and must choose a new password at first sign-in.</p>
          </section>

          <section id="reminders" className="guide-section">
            <div className="guide-section-heading">
              <Mail size={22} />
              <div>
                <span>06</span>
                <h2>Balance emails and reminders</h2>
              </div>
            </div>
            <p>On a child account, choose <em>Email balance</em> to review the recipient, current balance, and APR before sending. The email includes the balance and a sign-in link—not the full ledger.</p>
            <div className="guide-callout">
              <Bell size={21} />
              <p>You can also schedule a balance email for a specific day from 1 through 28 each month, or turn monthly reminders off at any time.</p>
            </div>
          </section>

          <section id="child-view" className="guide-section">
            <div className="guide-section-heading">
              <ShieldCheck size={22} />
              <div>
                <span>07</span>
                <h2>The child experience</h2>
              </div>
            </div>
            <p>A child signs in through the same sign-in page as a parent. After replacing their temporary password, they land on a read-only dashboard showing only their account.</p>
            <ul className="guide-checklist">
              <li>Review the current balance, APR, and repayment progress.</li>
              <li>See a dated history of loans, payments, adjustments, and interest.</li>
              <li>Download the ledger for personal records.</li>
              <li>Contact the parent directly if an entry appears incorrect.</li>
            </ul>
          </section>

          <section id="good-records" className="guide-section">
            <div className="guide-section-heading">
              <BookOpen size={22} />
              <div>
                <span>08</span>
                <h2>Keeping good records</h2>
              </div>
            </div>
            <ul className="guide-checklist">
              <li>Enter transactions promptly and use the date money actually changed hands.</li>
              <li>Add a short, specific note to make each entry understandable later.</li>
              <li>Review the calculated amount before posting interest.</li>
              <li>Use a unique password and share temporary credentials through a private channel.</li>
              <li>Download the ledger periodically if your family wants an offline copy.</li>
            </ul>
            <p className="guide-small">KinLedger helps families maintain a shared record; it does not replace legal, tax, or financial advice. Consult a qualified financial adviser, tax professional, or legal representative, and review the <Link href="/legal">Legal &amp; Loan Disclaimer</Link>, before relying on a family loan.</p>
          </section>

          <footer className="guide-footer">
            <div>
              <strong>Ready to explore?</strong>
              <p>Try the sample family workspace or return to KinLedger.</p>
            </div>
            <div>
              <Link href="/demo" className="button button-primary">Open the demo</Link>
              <Link href="/" className="button button-ghost">Back home</Link>
            </div>
          </footer>
        </article>
      </div>
    </main>
  );
}
