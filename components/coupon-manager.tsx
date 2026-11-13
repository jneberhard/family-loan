"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Copy, Plus, Ticket, X } from "lucide-react";

type CouponCode = {
  id: string;
  code: string;
  active: boolean;
  expiresAt: number | null;
  maxRedemptions: number | null;
  timesRedeemed: number;
  percentOff: number | null;
  duration: string | null;
  durationInMonths: number | null;
};

export function CouponManager() {
  const [codes, setCodes] = useState<CouponCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [duration, setDuration] = useState("once");

  async function loadCodes() {
    setLoading(true);
    try {
      const response = await fetch("/api/super-admin/coupons");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load coupon codes.");
      setCodes(result.codes ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load coupon codes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCodes(); }, []);

  async function createCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setWorking(true);
    setError("");
    setNotice("");
      const data = new FormData(form);
    try {
      const response = await fetch("/api/super-admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: data.get("code"),
          percentOff: data.get("percentOff"),
          duration,
          durationInMonths: data.get("durationInMonths"),
          maxRedemptions: data.get("maxRedemptions"),
          expiresAt: data.get("expiresAt"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create that coupon code.");
      form.reset();
      setDuration("once");
      setNotice(`${result.code} is ready to use at subscription checkout.`);
      await loadCodes();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create that coupon code.");
    } finally {
      setWorking(false);
    }
  }

  async function disableCode(code: CouponCode) {
    if (!window.confirm(`Disable ${code.code}? It can no longer be redeemed.`)) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(`/api/super-admin/coupons/${code.id}`, { method: "PATCH" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to disable this code.");
      setCodes((current) => current.map((item) => item.id === code.id ? { ...item, active: false } : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to disable this code.");
    } finally {
      setWorking(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`${code} copied.`);
    } catch {
      setNotice(code);
    }
  }

  return (
    <section className="coupon-management" id="coupon-management">
      <div className="coupon-heading">
        <div><span className="section-kicker">Subscription tools</span><h2>Coupon codes</h2><p>Create and manage subscription discounts.</p></div>
        <span className="coupon-icon"><Ticket size={20} /></span>
      </div>
      <form className="coupon-form" onSubmit={createCode}>
        <label>Code<input name="code" autoCapitalize="characters" minLength={4} maxLength={32} placeholder="FAMILYTESTER" required /></label>
        <label>Discount percent<input name="percentOff" type="number" min={1} max={100} step={1} defaultValue={100} required /></label>
        <label>Duration<select value={duration} onChange={(event) => setDuration(event.target.value)}><option value="once">First invoice</option><option value="repeating">Limited months</option><option value="forever">For every renewal</option></select></label>
        {duration === "repeating" && <label>Number of months<input name="durationInMonths" type="number" min={1} max={24} defaultValue={3} required /></label>}
        <label>Maximum uses<input name="maxRedemptions" type="number" min={1} placeholder="No limit" /></label>
        <label>Expiration date<input name="expiresAt" type="date" /></label>
        <button className="button button-primary" type="submit" disabled={working}><Plus size={16} />{working ? "Saving…" : "Create code"}</button>
      </form>
      {error && <p className="form-error coupon-message" role="alert">{error}</p>}
      {notice && <p className="coupon-notice" role="status"><Check size={15} />{notice}</p>}
      <div className="coupon-list-heading"><h3>Created codes</h3><span>Showing up to 100 most recent</span></div>
      {loading ? <p className="coupon-empty">Loading coupon codes…</p> : codes.length ? (
        <div className="coupon-list">
          {codes.map((code) => (
            <article className="coupon-row" key={code.id}>
              <div className="coupon-row-main"><strong>{code.code}</strong><small>{code.percentOff ?? 0}% off · {code.duration === "repeating" ? `${code.durationInMonths} months` : code.duration === "forever" ? "ongoing" : "first invoice"}</small></div>
              <div className="coupon-usage"><span>{code.timesRedeemed}{code.maxRedemptions ? ` / ${code.maxRedemptions}` : " uses"}</span>{code.expiresAt && <small><Clock3 size={12} /> Expires {new Date(code.expiresAt * 1000).toLocaleDateString()}</small>}</div>
              <span className={`coupon-status ${code.active ? "active" : "inactive"}`}>{code.active ? "Active" : "Disabled"}</span>
              <button type="button" className="icon-button coupon-copy" onClick={() => void copyCode(code.code)} title="Copy code" aria-label={`Copy ${code.code}`}><Copy size={15} /></button>
              {code.active && <button type="button" className="icon-button coupon-disable" onClick={() => void disableCode(code)} disabled={working} title="Disable code" aria-label={`Disable ${code.code}`}><X size={15} /></button>}
            </article>
          ))}
        </div>
      ) : <p className="coupon-empty">No coupon codes yet. Create one above.</p>}
    </section>
  );
}
