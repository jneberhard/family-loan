"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "@/components/password-input";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== data.get("confirmPassword")) {
      setError("The new passwords do not match.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: data.get("currentPassword"),
        newPassword,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Unable to change your password.");
      setLoading(false);
      return;
    }
    router.push(result.role === "SUPER_USER" ? "/super-admin" : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="login-form">
      <label>
        Current password
        <PasswordInput name="currentPassword" autoComplete="current-password" required />
      </label>
      <label>
        New password
        <PasswordInput
          name="newPassword"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      <label>
        Confirm new password
        <PasswordInput
          name="confirmPassword"
          autoComplete="new-password"
          minLength={12}
          required
        />
      </label>
      <p className="form-hint">Use at least 12 characters and a password you do not use elsewhere.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-large" disabled={loading}>
        {loading ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
