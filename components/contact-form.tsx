"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Send, X } from "lucide-react";

function ContactForm({ defaultSubject = "General question" }: { defaultSubject?: string }) {
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
        <select name="subject" defaultValue={defaultSubject}>
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

export function ContactModal({
  triggerLabel = "Contact",
  triggerClassName = "button button-primary",
  defaultSubject,
}: {
  triggerLabel?: string;
  triggerClassName?: string;
  defaultSubject?: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
          ),
        ).filter((element) => element.tabIndex !== -1);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          className="contact-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={modalRef}
            className="contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <header className="contact-modal-header">
              <div>
                <span className="section-kicker">Contact KinLedger</span>
                <h2 id={titleId}>How can we help?</h2>
                <p>Send us a note and the KinLedger team will follow up.</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="icon-button"
                aria-label="Close contact form"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>
            <ContactForm defaultSubject={defaultSubject} />
          </section>
        </div>
      )}
    </>
  );
}
