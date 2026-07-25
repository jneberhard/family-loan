"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        subject: data.get("subject"),
        message: data.get("message"),
        website: data.get("website"),
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStatus("error");
      setMessage(result.error ?? "Your message could not be sent. Please try again.");
      return;
    }

    form.reset();
    setStatus("sent");
    setMessage("Thank you. Your message has been sent to KinLedger.");
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="contact-field-grid">
        <label>
          Your name
          <input name="name" autoComplete="name" maxLength={100} required />
        </label>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" maxLength={254} required />
        </label>
      </div>
      <label>
        What can we help with?
        <select name="subject" defaultValue="General question">
          <option>General question</option>
          <option>Parent-lender account</option>
          <option>Technical support</option>
          <option>Privacy or security</option>
        </select>
      </label>
      <label>
        Message
        <textarea name="message" minLength={20} maxLength={5000} rows={6} required />
      </label>
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
          {status === "sending" ? "Sending…" : <><Send size={17} /> Send message</>}
        </button>
      </div>
    </form>
  );
}
