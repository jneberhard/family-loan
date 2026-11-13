"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

type Plan = "MONTHLY" | "YEARLY";

export function PricingPlans({
  checkoutState,
  signedIn,
  canManageBilling,
  isPaid,
  hasCustomer,
  plan,
  billingStatus,
}: {
  checkoutState: string;
  signedIn: boolean;
  canManageBilling: boolean;
  isPaid: boolean;
  hasCustomer: boolean;
  plan: string;
  billingStatus: string;
}) {
  const [busy, setBusy] = useState<Plan | "PORTAL" | "">("");
  const [error, setError] = useState("");

  async function startCheckout(selectedPlan: Plan) {
    if (!signedIn) return;
    setBusy(selectedPlan);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error ?? "Unable to open checkout.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open checkout.");
      setBusy("");
    }
  }

  async function manageBilling() {
    setBusy("PORTAL");
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error ?? "Unable to open billing management.");
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to open billing management.");
      setBusy("");
    }
  }

  const signupHref = (selectedPlan: Plan) => `/become-parent?plan=${selectedPlan}`;

  return (
    <section className="pricing-content container">
      <span className="section-kicker"><Sparkles size={15} /> Family plans</span>
      <h1>One family. One simple plan.</h1>
      <p className="pricing-intro">Start free with one parent and one child, or subscribe once to give your whole family access.</p>
      {checkoutState === "success" && <p className="pricing-notice success">Checkout complete. Your family plan will activate as soon as Stripe confirms your subscription.</p>}
      {checkoutState === "cancelled" && <p className="pricing-notice">Checkout was canceled. Your family can continue using the free plan.</p>}
      {isPaid && <p className="pricing-notice success">Your family currently has full access on the {plan === "LEGACY" ? "grandfathered" : plan.toLowerCase()} plan{billingStatus === "ACTIVE" ? "" : ` (${billingStatus.toLowerCase()})`}.</p>}
      {error && <p className="form-error pricing-error" role="alert">{error}</p>}

      <div className="pricing-grid">
        <article className="pricing-card">
          <span className="pricing-plan-name">Free</span>
          <div className="pricing-price"><strong>$0</strong><span>forever</span></div>
          <p>Everything a small family needs to start keeping a clear loan record.</p>
          <ul>
            <li><Check /> One parent administrator</li>
            <li><Check /> One child account</li>
            <li><Check /> Loan and payment ledger</li>
            <li><Check /> Automatic interest tracking</li>
            <li><Check /> Read-only child access</li>
          </ul>
          {signedIn ? <span className="pricing-current">Available to every family</span> : <Link className="button button-soft button-large" href="/become-parent?plan=FREE">Start free</Link>}
        </article>

        <article className="pricing-card pricing-card-featured">
          <span className="pricing-ribbon">For the whole family</span>
          <span className="pricing-plan-name">Family subscription</span>
          <div className="pricing-price"><strong>$2.99</strong><span>per month</span></div>
          <div className="pricing-alternative">or <strong>$29.99 per year</strong> <span>($2.50/month)</span></div>
          <p>One subscription covers the whole family workspace. Members are not billed individually.</p>
          <ul>
            <li><Check /> Up to 4 parent administrators</li>
            <li><Check /> Up to 10 child loan accounts</li>
            <li><Check /> Everything in Free</li>
            <li><Check /> Family access management</li>
            <li><Check /> Balance reminders and account tools</li>
          </ul>
          {isPaid && plan === "LEGACY" ? (
            <span className="pricing-current">This family workspace has full access.</span>
          ) : isPaid && hasCustomer && canManageBilling ? (
            <button className="button button-primary button-large" onClick={manageBilling} disabled={Boolean(busy)}>{busy === "PORTAL" ? "Opening billing…" : "Manage subscription"}</button>
          ) : signedIn ? (
            canManageBilling ? (
              <div className="pricing-button-stack">
                <button className="button button-primary button-large" onClick={() => startCheckout("MONTHLY")} disabled={Boolean(busy)}>{busy === "MONTHLY" ? "Opening checkout…" : "Subscribe monthly"}</button>
                <button className="button button-soft" onClick={() => startCheckout("YEARLY")} disabled={Boolean(busy)}>{busy === "YEARLY" ? "Opening checkout…" : "Subscribe yearly · $29.99"}</button>
              </div>
            ) : <span className="pricing-current">The original parent manages family billing.</span>
          ) : (
            <div className="pricing-button-stack">
              <Link className="button button-primary button-large" href={signupHref("MONTHLY")}>Choose monthly</Link>
              <Link className="button button-soft" href={signupHref("YEARLY")}>Choose yearly</Link>
            </div>
          )}
        </article>
      </div>

      <div className="pricing-explainer">
        <h2>How family pricing works</h2>
        <p>The subscription belongs to the family workspace, not to each person. One payment covers up to 4 parent administrators and 10 child loan accounts. If a paid subscription ends, the original parent and the first child account created remain active on Free; other accounts are hidden with their records kept safely. Renewing the family subscription restores access to the full family.</p>
        <p>Family workspaces created before subscriptions were introduced keep grandfathered paid-tier access, including these account limits. They are not automatically billed.</p>
        {!signedIn && <p>Free workspaces are available immediately. A paid family plan activates as soon as checkout confirms payment.</p>}
        {signedIn && !isPaid && canManageBilling && billingStatus === "INCOMPLETE" && <p>Your family is on Free until checkout is completed and your subscription is confirmed.</p>}
      </div>
    </section>
  );
}
