"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.error ?? "Unable to sign in.");
      setLoading(false);
      return;
    }
    const result = await response.json();
    router.push(
      result.mustChangePassword
        ? "/change-password"
        : result.role === "SUPER_USER"
          ? "/super-admin"
          : "/dashboard",
    );
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="login-form">
      <label>
        Email address
        <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" placeholder="••••••••" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-large" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
