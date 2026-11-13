"use client";

import { useCallback, useEffect, useState } from "react";

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;
const LAST_ACTIVITY_KEY = "family-loan-last-activity";

export function InactivityTimeout({ children }: { children: React.ReactNode }) {
  const [remainingMs, setRemainingMs] = useState(IDLE_TIMEOUT_MS);
  const [signingOut, setSigningOut] = useState(false);

  const recordActivity = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    setRemainingMs(IDLE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) recordActivity();

    const tick = () => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
      setRemainingMs(Math.max(0, IDLE_TIMEOUT_MS - (Date.now() - lastActivity)));
    };
    const activityEvents = ["pointerdown", "keydown", "touchstart", "scroll", "wheel"] as const;
    activityEvents.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    window.addEventListener("storage", tick);
    const interval = window.setInterval(tick, 1000);
    tick();
    return () => {
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("storage", tick);
      window.clearInterval(interval);
    };
  }, [recordActivity]);

  useEffect(() => {
    if (remainingMs > 0) return;
    setSigningOut(true);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .catch(() => undefined)
      .finally(() => window.location.replace("/login?reason=idle"));
  }, [remainingMs]);

  const warningOpen = remainingMs <= WARNING_BEFORE_MS && remainingMs > 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);

  return (
    <>
      {children}
      {warningOpen && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-description" style={overlayStyle}>
          <section style={dialogStyle}>
            <h2 id="idle-title" style={{ margin: "0 0 10px", color: "#173c2a", fontSize: 22 }}>Still there?</h2>
            <p id="idle-description" style={{ margin: "0 0 20px", color: "#53645a", lineHeight: 1.55 }}>
              You’ll be signed out in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")} due to inactivity.
            </p>
            <button type="button" onClick={recordActivity} style={buttonStyle}>Stay signed in</button>
          </section>
        </div>
      )}
      {signingOut && <div role="status" style={overlayStyle}><section style={dialogStyle}>Signing you out…</section></div>}
    </>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center",
  padding: 20, background: "rgba(12, 26, 18, 0.54)",
};
const dialogStyle: React.CSSProperties = {
  width: "min(100%, 420px)", padding: 28, borderRadius: 20, background: "#fff",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.24)", fontFamily: "var(--font-sans), sans-serif",
};
const buttonStyle: React.CSSProperties = {
  minHeight: 46, width: "100%", border: 0, borderRadius: 12, background: "#215c43",
  color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
};
