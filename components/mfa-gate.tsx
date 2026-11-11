"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = { enabled: boolean; verified: boolean };

export function MfaGate() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const request = useCallback(async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Unable to continue.");
    return result as T;
  }, []);

  useEffect(() => {
    request<Status>("/api/auth/mfa")
      .then(setStatus)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to check MFA status."));
  }, [request]);

  async function beginSetup() {
    setLoading(true);
    setError("");
    try {
      const result = await request<{ secret: string }>("/api/auth/mfa/setup", "POST", {});
      setSecret(result.secret);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start setup.");
    } finally {
      setLoading(false);
    }
  }

  async function enableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await request<{ recoveryCodes: string[] }>("/api/auth/mfa/enable", "POST", {
        password,
        secret,
        code,
      });
      setRecoveryCodes(result.recoveryCodes);
      setStatus({ enabled: true, verified: true });
      setPassword("");
      setCode("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to enable MFA.");
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await request("/api/auth/mfa/verify", "POST", { code });
      router.replace("/super-admin");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to verify your code.");
    } finally {
      setLoading(false);
    }
  }

  if (!status) return <p aria-live="polite">{error || "Checking secure sign-in…"}</p>;

  if (recoveryCodes.length > 0) {
    return (
      <div className="login-form">
        <p><strong>Save these recovery codes now.</strong> Each code works once if you can’t access your authenticator. They won’t be shown again.</p>
        <pre className="mfa-recovery-codes">{recoveryCodes.join("\n")}</pre>
        <button className="button button-primary button-large" onClick={() => router.replace("/super-admin")}>
          I saved the codes
        </button>
      </div>
    );
  }

  if (status.enabled) {
    return (
      <form className="login-form" onSubmit={verify}>
        <p>Enter the six-digit code from your authenticator app. You may also use one unused recovery code.</p>
        <label>
          Authenticator or recovery code
          <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" autoCapitalize="characters" autoFocus required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-large" disabled={loading}>
          {loading ? "Verifying…" : "Verify and continue"}
        </button>
      </form>
    );
  }

  if (!secret) {
    return (
      <div className="login-form">
        <p>Authenticator setup is required before you can open the super-user console.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary button-large" disabled={loading} onClick={beginSetup}>
          {loading ? "Preparing…" : "Set up authenticator"}
        </button>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={enableMfa}>
      <p>Add a new account in your authenticator app and enter this setup key. Keep it private.</p>
      <label>
        Authenticator setup key
        <input value={secret} readOnly onFocus={(event) => event.currentTarget.select()} />
      </label>
      <label>
        Current password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
      </label>
      <label>
        Six-digit authenticator code
        <input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" required />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary button-large" disabled={loading}>
        {loading ? "Enabling…" : "Enable MFA"}
      </button>
    </form>
  );
}
