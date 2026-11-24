import { publicPageMetadata } from "@/lib/seo";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = publicPageMetadata("/privacy", "Privacy", "How Family Loan Ledger handles family account and loan information.");

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="privacy-page">
      <article className="privacy-card">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="brand privacy-brand">
          <Image src="/family-loan-ledger-logo.png" alt="" width={48} height={48} />
          <span>Family Loan Ledger</span>
        </div>
        <span className="privacy-icon"><ShieldCheck size={22} /></span>
        <h1>Privacy notice</h1>
        <p className="privacy-updated">Last updated November 20, 2026</p>
        <p>Family Loan Ledger is operated by JR Studios, LLC.</p>

        <section>
          <h2>Information we handle</h2>
          <p>Family Loan Ledger stores account names, email addresses, password hashes, family workspace membership, child loan records, ledger entries, interest rates, account deletion requests, and security activity needed to operate the service. Contact and deletion request notices are processed by Resend when email delivery is configured.</p>
        </section>
        <section>
          <h2>How information is used</h2>
          <p>We use this information to authenticate users, enforce parent and read-only child permissions, calculate and display family loan balances, investigate security events, provide support, and operate Family Loan Ledger. We do not sell personal information.</p>
        </section>
        <section>
          <h2>Service providers</h2>
          <p>Application hosting is provided by Vercel and database hosting by Neon. Resend processes contact-form messages and account deletion request notices after email delivery is configured. Deletion notice emails contain a request reference rather than the requester&apos;s name or email. These providers process information only as needed to deliver their services.</p>
        </section>
        <section>
          <h2>Advertising in the mobile app</h2>
          <p>The free mobile app supports banner advertising through Google AdMob on parent administrator dashboards. Child accounts and families with paid or grandfathered access do not display ads. We do not send account names, email addresses, loan balances, or ledger entries to AdMob.</p>
          <p>When advertising is enabled, Google may process device identifiers, IP addresses, ad interactions, and diagnostic information to deliver ads, measure performance, and prevent fraud. We request non-personalized ads, disable publisher first-party identifiers, and delay ad measurement until the consent flow permits ad requests. Non-personalized ads can still use device storage and process personal data.</p>
          <p>Where required, a consent message appears before ads are requested. You can revisit available choices using the app&apos;s Ad privacy choices control. Declining consent or tracking permission does not prevent access to your family ledger. See <a href="https://policies.google.com/technologies/ads">Google&apos;s advertising information</a> and <a href="https://policies.google.com/privacy">Google&apos;s privacy policy</a> for details.</p>
        </section>
        <section>
          <h2>Access and sharing</h2>
          <p>Approved parent administrators can view and change records within their family workspace. A child account can view only its own loan ledger and cannot change it. Family Loan Ledger may disclose information when required by law or necessary to protect the service and its users.</p>
        </section>
        <section>
          <h2>Retention and requests</h2>
          <p>Account information can be deleted from the mobile app after password confirmation, or requested through the <Link href="/delete-account">account deletion page</Link>. When a user account is deleted, sign-in access and identifying account details are removed. Shared family loan entries remain with the family in anonymized form. If the user is the family&apos;s only administrator, deletion waits until family access can be transferred. Records may also be retained as reasonably necessary for security, dispute resolution, legal obligations, and backups.</p>
        </section>
        <section>
          <h2>Security</h2>
          <p>Family Loan Ledger uses encrypted connections, password hashing, signed secure cookies, server-side authorization, login lockouts and rate limits, required authenticator MFA for super-user accounts, session revocation, request-origin checks, security headers, and an audit trail. No online service can guarantee absolute security, so unique passwords and careful handling of temporary credentials remain important.</p>
        </section>
        <section>
          <h2>Changes</h2>
          <p>This notice may be updated as Family Loan Ledger and its providers change. The revised date above will identify the current version.</p>
        </section>
      </article>
    </main>
  );
}
