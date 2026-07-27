import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Scale, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Legal & Loan Disclaimer",
  description: "Important limitations and responsibilities for families using KinLedger.",
};

export default async function LegalPage() {
  const session = await getSession();
  const returnHref = session
    ? session.mustChangePassword
      ? "/change-password"
      : session.role === "SUPER_USER"
        ? "/super-admin"
        : "/dashboard"
    : "/";

  return (
    <main className="privacy-page legal-page">
      <article className="privacy-card legal-card">
        <Link href={returnHref} className="back-link">
          <ArrowLeft size={17} /> {session ? "Back to dashboard" : "Back home"}
        </Link>
        <div className="brand privacy-brand">
          <Image src="/kinledger-logo.png" alt="" width={48} height={48} />
          <span>KinLedger</span>
        </div>
        <span className="privacy-icon"><Scale size={22} /></span>
        <h1>Legal &amp; loan disclaimer</h1>
        <p className="privacy-updated">Last updated July 27, 2026</p>

        <div className="legal-warning">
          <AlertTriangle size={22} />
          <div>
            <strong>KinLedger is a record-keeping tool—not a loan agreement.</strong>
            <p>Consult a qualified financial adviser, tax professional, or legal representative before making, documenting, changing, forgiving, or enforcing a family loan.</p>
          </div>
        </div>

        <section>
          <h2>Informal, trust-based family arrangements</h2>
          <p>KinLedger is designed to help parents and children keep a shared record of an informal, trust-based family loan. KinLedger does not lend money, transfer funds, verify that money changed hands, establish repayment obligations, create a promissory note or security interest, or make any family arrangement legally enforceable.</p>
        </section>
        <section>
          <h2>Not legal, tax, or financial advice</h2>
          <p>Balances, interest calculations, reminders, examples, and other information provided by KinLedger are for organizational and informational purposes only. They are not legal, tax, accounting, investment, or financial advice and should not be treated as a recommendation about whether or how to make a loan.</p>
        </section>
        <section>
          <h2>Your responsibility</h2>
          <p>Parents and children are solely responsible for deciding the terms of their arrangement, entering accurate records, keeping supporting documents, obtaining any required signatures or disclosures, determining an appropriate interest rate, and complying with applicable laws and tax rules. KinLedger does not monitor payments, collect debts, resolve disputes, report to credit bureaus, or act as an agent, fiduciary, escrow service, lender, borrower, or mediator.</p>
        </section>
        <section>
          <h2>Tax considerations</h2>
          <p>Interest-free and below-market family loans can have federal, state, or local tax consequences. The IRS publishes Applicable Federal Rates each month and describes special treatment for certain below-market loans. Review the current <a href="https://www.irs.gov/applicable-federal-rates" target="_blank" rel="noreferrer">IRS Applicable Federal Rates</a> and consult a qualified tax professional for advice about your circumstances.</p>
        </section>
        <section>
          <h2>No guarantee or enforcement</h2>
          <p>KinLedger does not guarantee repayment, accuracy, tax treatment, legal validity, collectability, or any outcome between family members. A ledger entry or calculated balance is not proof that a debt is valid or enforceable. Use of KinLedger is at your own risk, and each family remains responsible for its own decisions and relationship.</p>
        </section>
        <section>
          <h2>Indemnification</h2>
          <p>To the fullest extent permitted by applicable law, you agree to defend, indemnify, and hold harmless KinLedger and its owners, operators, affiliates, service providers, officers, employees, and agents from third-party claims, liabilities, damages, judgments, losses, costs, and reasonable legal fees arising from your family loan, your records or instructions, your violation of law or another person&apos;s rights, or your misuse of the service. This provision does not apply where indemnification is prohibited by law.</p>
        </section>
        <section>
          <h2>Professional review recommended</h2>
          <div className="legal-review">
            <ShieldCheck size={20} />
            <p>Before relying on a family loan or this disclaimer, ask a licensed attorney to prepare or review any promissory note and advise on enforceability, and ask a qualified financial or tax professional about interest, reporting, gifts, and other consequences.</p>
          </div>
        </section>
        <section>
          <h2>About this notice</h2>
          <p>This page provides important notice about KinLedger&apos;s intended use and limitations. It is not a substitute for a professionally prepared agreement, and adding information to KinLedger does not create or replace a contract between family members.</p>
        </section>
      </article>
    </main>
  );
}
