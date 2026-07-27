"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

export function ParentRegistrationForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Unable to submit your application.");
      setLoading(false);
      return;
    }
    setSubmitted({ familyName: result.familyName });
  }

  if (submitted) {
    return (
      <div className="registration-success">
        <span><Clock3 size={25} /></span>
        <h2>Application received</h2>
        <p>
          <strong>{submitted.familyName}</strong> is waiting for super-user approval.
          You’ll be able to sign in once the application is approved.
        </p>
        <div><CheckCircle2 size={17} /> Your account and password have been securely saved.</div>
        <Link href="/login" className="button button-primary button-large">Return to sign in</Link>
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
        Submitting creates a pending parent-lender workspace. A KinLedger super user
        must approve it before you can sign in or create child accounts.
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-large" disabled={loading}>
        {loading ? "Submitting application…" : "Submit for approval"}
      </button>
    </form>
  );
}
