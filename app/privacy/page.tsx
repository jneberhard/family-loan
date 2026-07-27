import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ContactModal } from "@/components/contact-form";

export const metadata = {
  title: "Privacy",
  description: "How KinLedger handles family account and loan information.",
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <article className="privacy-card">
        <Link href="/" className="back-link"><ArrowLeft size={17} /> Back home</Link>
        <div className="brand privacy-brand">
          <Image src="/kinledger-logo.png" alt="" width={48} height={48} />
          <span>KinLedger</span>
        </div>
        <span className="privacy-icon"><ShieldCheck size={22} /></span>
        <h1>Privacy notice</h1>
        <p className="privacy-updated">Last updated July 25, 2026</p>

        <section>
          <h2>Information we handle</h2>
          <p>KinLedger stores account names, email addresses, encrypted password hashes, family workspace membership, child loan records, ledger entries, interest rates, and security activity needed to operate the service. Contact messages are processed only when the contact service is configured.</p>
        </section>
        <section>
          <h2>How information is used</h2>
          <p>We use this information to authenticate users, enforce parent and read-only child permissions, calculate and display family loan balances, investigate security events, provide support, and operate KinLedger. We do not sell personal information.</p>
        </section>
        <section>
          <h2>Service providers</h2>
          <p>Application hosting is provided by Vercel and database hosting by Neon. Resend will process contact-form messages after that optional service is configured. These providers process information only as needed to deliver their services.</p>
        </section>
        <section>
          <h2>Access and sharing</h2>
          <p>Approved parent administrators can view and change records within their family workspace. A child account can view only its own loan ledger and cannot change it. KinLedger may disclose information when required by law or necessary to protect the service and its users.</p>
        </section>
        <section>
          <h2>Retention and requests</h2>
          <p>Account and loan information is retained while a family uses KinLedger and as reasonably necessary for security, dispute resolution, legal obligations, and backups. To request access, correction, export, or deletion, use the <ContactModal triggerLabel="KinLedger contact form" triggerClassName="privacy-contact-trigger" defaultSubject="Privacy or security" />. Include your phone number and account number in the message so we can verify your identity and authority over the family workspace before fulfilling the request.</p>
        </section>
        <section>
          <h2>Security</h2>
          <p>KinLedger uses encrypted connections, password hashing, signed secure cookies, server-side authorization, login lockouts, session revocation, request-origin checks, security headers, and an audit trail. No online service can guarantee absolute security, so unique passwords and careful handling of temporary credentials remain important.</p>
        </section>
        <section>
          <h2>Changes</h2>
          <p>This notice may be updated as KinLedger and its providers change. The revised date above will identify the current version.</p>
        </section>
      </article>
    </main>
  );
}
