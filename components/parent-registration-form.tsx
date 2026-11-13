"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

type SignupPlan = "FREE" | "MONTHLY" | "YEARLY";

export function ParentRegistrationForm({ initialPlan = "FREE" }: { initialPlan?: SignupPlan }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<SignupPlan>(initialPlan);
  const [submitted, setSubmitted] = useState<{ familyName: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register-parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        familyName: data.get("familyName"),
        email: data.get("email"),
        password: data.get("password"),
        interestPostingDay: data.get("interestPostingDay"),
        legalAcknowledgment: data.get("legalAcknowledgment") === "on",
        plan,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Unable to submit your application.");
      setLoading(false);
      return;
    }
    if (plan !== "FREE") {
      if (!result.checkoutUrl) {
        setError("Your application was saved, but checkout could not be started. Sign in to resume setup.");
        setLoading(false);
        return;
      }
      window.location.assign(result.checkoutUrl);
      return;
    }
    setSubmitted({ familyName: result.familyName });
  }

  if (submitted) {
    return (
      <div className="registration-success">
        <span><CheckCircle2 size={25} /></span>
        <h2>Family workspace ready</h2>
        <p><strong>{submitted.familyName}</strong> is ready. Your free workspace includes one parent and one child.</p>
        <div><CheckCircle2 size={17} /> Your family can sign in and start using the ledger now.</div>
        <Link href="/login" className="button button-primary button-large">Sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="login-form registration-form">
      <div className="field-grid">
        <label>
          Your full name
          <input name="name" autoComplete="name" placeholder="James Bennett" required />
        </label>
        <label>
          Family workspace
          <input name="familyName" placeholder="Bennett Family" required />
        </label>
      </div>
      <fieldset className="plan-choice-fieldset">
        <legend>Choose your family plan</legend>
        <div className="plan-choice-grid">
          {([
            ["FREE", "Free", "$0", "One parent and one child"],
            ["MONTHLY", "Monthly", "$2.99 / month", "Full family access"],
            ["YEARLY", "Yearly", "$29.99 / year", "Full family access · save $5.89"],
          ] as const).map(([value, title, price, description]) => (
            <label className={`plan-choice ${plan === value ? "selected" : ""}`} key={value}>
              <input type="radio" name="plan" value={value} checked={plan === value} onChange={() => setPlan(value)} />
              <span><strong>{title}</strong><b>{price}</b><small>{description}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Email address
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </label>
      <div className="field-grid">
        <label>
          Password
          <PasswordInput name="password" autoComplete="new-password" minLength={12} placeholder="12+ characters" required />
        </label>
        <label>
          Monthly interest day
          <select name="interestPostingDay" defaultValue="5">
            {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>Day {day}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="registration-note">
        {plan === "FREE"
          ? "Free workspaces are available as soon as you sign up. Start with one parent and one child account."
          : "Complete secure checkout to activate full family access immediately. One subscription covers the entire family."}
      </p>
      <label className="legal-acknowledgment">
        <input name="legalAcknowledgment" type="checkbox" required />
        <span>
          I understand Family Loan Ledger is a record-keeping tool, not a legally binding loan
          agreement or professional advice, and I have read the{" "}
          <Link href="/legal" target="_blank" rel="noreferrer">Legal &amp; Loan Disclaimer</Link>.
        </span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-large" disabled={loading}>
        {loading ? "Submitting application…" : plan === "FREE" ? "Submit free application" : "Submit subscription application"}
      </button>
    </form>
  );
}
