"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function AccountDeletionForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/account/deletion-request/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          website: formData.get("website"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to send the request.");
      form.reset();
      setStatus("sent");
      setMessage(result.message ?? "Your request was received.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to send the request.");
    }
  }

  return (
    <form className="contact-form deletion-form" onSubmit={submit}>
      <div className="contact-field-grid">
        <label>
          Name on your account
          <input name="name" autoComplete="name" maxLength={100} required />
        </label>
        <label>
          Account email
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
      </div>
      <label className="contact-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="contact-submit-row">
        <p className={`contact-status ${status}`} role="status" aria-live="polite">
          {status === "sent" && <CheckCircle2 size={17} />}
          {message}
        </p>
        <button className="button button-primary button-large" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : <><Send size={17} /> Submit request</>}
        </button>
      </div>
    </form>
  );
}
