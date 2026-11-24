import { publicPageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = publicPageMetadata("/terms", "Terms of Service", "Terms for using the Family Loan Ledger website and mobile apps.");

export default function TermsPage() {
  return (
    <main id="main-content" tabIndex={-1} className="privacy-page legal-page">
      <article className="privacy-card legal-card">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="brand privacy-brand">
          <Image src="/family-loan-ledger-logo.png" alt="" width={48} height={48} />
          <span>Family Loan Ledger</span>
        </div>
        <span className="privacy-icon"><FileText size={22} /></span>
        <h1>Terms of Service</h1>
        <p className="privacy-updated">Last updated November 18, 2026</p>

        <section>
          <h2>1. Agreement and the service</h2>
          <p>These Terms of Service (the “Terms”) govern your access to and use of the Family Loan Ledger website, mobile apps, and related services (together, the “Service”). The Service is operated by JR Studios, LLC. By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service. “We,” “us,” and “our” refer to JR Studios, LLC.</p>
        </section>
        <section>
          <h2>2. Eligibility and family accounts</h2>
          <p>You must be legally able to enter into an agreement to use the Service. A parent administrator who creates a family workspace is responsible for inviting family members, assigning access, and ensuring that each person is authorized to use the records provided to them. Parent administrators can manage family loan records. Child accounts have read-only access to their own ledger.</p>
        </section>
        <section>
          <h2>3. Your account and responsibilities</h2>
          <p>Provide accurate account information, keep your sign-in credentials confidential, and promptly tell us if you suspect unauthorized access. You are responsible for activity under your account and for keeping copies of records you need. Do not share temporary passwords, access another person’s account without permission, interfere with the Service, or use it unlawfully.</p>
        </section>
        <section>
          <h2>4. Family loan records are not loan agreements</h2>
          <p>The Service is a record-keeping tool. We do not lend money, transfer funds, verify that money changed hands, create or enforce a loan agreement, collect debts, or resolve family disputes. Ledger entries and calculated balances may contain errors and do not establish that a debt is valid or legally enforceable. You and your family are responsible for agreeing on loan terms, entering accurate information, and keeping any signed agreements or supporting documents.</p>
          <p>Interest calculations, reminders, and other information are for organizational purposes only and are not legal, tax, accounting, investment, or financial advice. Review our <Link href="/legal">Legal &amp; Loan Disclaimer</Link> and consult qualified professionals about your circumstances.</p>
        </section>
        <section>
          <h2>5. Plans, payment, and cancellation</h2>
          <p>The Service may include a free plan and paid family subscriptions. Current plan features and prices are shown on our <Link href="/pricing">pricing page</Link> or at checkout. Paid subscriptions renew for the selected billing period unless canceled. The family billing owner can manage or cancel a subscription through the billing controls provided in the Service. Cancellation stops future renewal; paid access generally continues through the period already paid for. Any refund rights required by law still apply.</p>
          <p>Payments may be processed by a third-party payment provider. That provider’s checkout and payment terms also apply to the transaction. You are responsible for applicable taxes and for keeping payment details current.</p>
        </section>
        <section>
          <h2>6. Your records and privacy</h2>
          <p>You retain responsibility for the information you and your family enter. You authorize us to host and process it as needed to provide and protect the Service. Our <Link href="/privacy">Privacy Notice</Link> explains the information we handle, how we use it, and how account deletion works. When an account is deleted, identifying account details are removed, but shared family ledger entries may be retained in anonymized form so the family’s records continue to work.</p>
        </section>
        <section>
          <h2>7. Service changes and availability</h2>
          <p>We may update, suspend, or discontinue parts of the Service to maintain or improve it, address security or legal requirements, or respond to operational needs. We will try to provide notice when a material change is practical. We do not guarantee uninterrupted or error-free operation. We may suspend or terminate access for a serious or repeated violation of these Terms, security risks, or legal requirements.</p>
        </section>
        <section>
          <h2>8. Intellectual property</h2>
          <p>We and our licensors own the Service, its software, branding, and related materials. We grant you a limited, personal, non-transferable, revocable right to use the Service for your family’s own record keeping, subject to these Terms. You may not copy, resell, reverse engineer, or misuse the Service except where applicable law does not allow that restriction.</p>
        </section>
        <section>
          <h2>9. Disclaimers and limits of liability</h2>
          <p>To the fullest extent permitted by law, the Service is provided “as is” and “as available,” without warranties of any kind. We do not guarantee the accuracy, completeness, legal effect, or availability of records, calculations, or reminders. To the fullest extent permitted by law, Family Loan Ledger will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, data, or goodwill arising from your use of the Service. Our total liability for claims relating to the Service will not exceed the amount you paid us for the Service during the 12 months before the event giving rise to the claim. These limits do not apply where prohibited by law.</p>
        </section>
        <section>
          <h2>10. Changes to these Terms</h2>
          <p>We may revise these Terms as the Service changes. We will update the date at the top of this page when we do. If a change materially affects your rights or obligations, we will provide notice through the Service or by email when practical. Continued use after the updated Terms take effect means you accept them.</p>
        </section>
        <section>
          <h2>11. Governing law and contact</h2>
          <p>These Terms are governed by the laws of the State of Utah, without regard to conflict-of-law rules. Any dispute must be brought in a state or federal court located in Utah, unless applicable law requires otherwise. For questions about these Terms, <Link href="/#contact">contact Family Loan Ledger</Link>.</p>
        </section>
      </article>
    </main>
  );
}
