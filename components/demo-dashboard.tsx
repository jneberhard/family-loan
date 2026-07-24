"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Eye,
  HandCoins,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  UserPlus,
  WalletCards,
  Trash2,
  X,
} from "lucide-react";
import { demoChildren, type DemoChild } from "@/lib/demo-data";
import { calculateAprInterest, calculateRunningLedger, type LedgerItem } from "@/lib/finance";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function nextPostingDate(postingDay: number) {
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth();
  if (today.getDate() >= postingDay) month += 1;
  if (month > 11) {
    year += 1;
    month = 0;
  }
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(postingDay).padStart(2, "0")}`;
}

function displayDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(isoDate: string) {
  const target = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((target.getTime() - localToday.getTime()) / 86_400_000));
}

type Role = "parent" | "child";
type Modal = "entry" | "edit" | "child" | "interest" | null;

const emptyChild: DemoChild = {
  id: "",
  name: "No child selected",
  initials: "—",
  email: "",
  purpose: "Create the first child account to begin",
  rate: 0,
  accent: "#81C784",
  entries: [],
};

export function DemoDashboard({
  initialChildren = demoChildren,
  initialRole = "parent",
  demoMode = true,
  interestPostingDay = 5,
}: {
  initialChildren?: DemoChild[];
  initialRole?: Role;
  demoMode?: boolean;
  interestPostingDay?: number;
}) {
  const [children, setChildren] = useState(initialChildren);
  const [selectedId, setSelectedId] = useState(initialChildren[0]?.id ?? "");
  const [role, setRole] = useState<Role>(initialRole);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerItem | null>(null);

  const selected = children.find((child) => child.id === selectedId) ?? children[0] ?? emptyChild;
  const ledgers = useMemo(
    () => new Map(children.map((child) => [child.id, calculateRunningLedger(child.entries)])),
    [children],
  );
  const selectedLedger = ledgers.get(selected.id) ?? [];
  const selectedBalance = selectedLedger.at(-1)?.balance ?? 0;
  const totalBalance = children.reduce(
    (sum, child) => sum + (ledgers.get(child.id)?.at(-1)?.balance ?? 0),
    0,
  );
  const payments = children.reduce(
    (sum, child) =>
      sum + child.entries.filter((entry) => entry.type === "Payment").reduce((n, entry) => n + Math.abs(entry.amount), 0),
    0,
  );
  const interestPeriod = useMemo(() => {
    const periodEnd = nextPostingDate(interestPostingDay);
    const eligible = selected.entries
      .filter((entry) => entry.date < periodEnd)
      .sort((a, b) => a.date.localeCompare(b.date));
    const latestInterest = eligible.filter((entry) => entry.type === "Interest").at(-1);
    const periodStart = latestInterest?.date ?? eligible[0]?.date ?? periodEnd;
    return {
      periodStart,
      periodEnd,
      calculation: calculateAprInterest(selected.entries, selected.rate, periodStart, periodEnd),
    };
  }, [interestPostingDay, selected.entries, selected.rate]);
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function switchRole(nextRole: Role) {
    setRole(nextRole);
    if (nextRole === "child") setSelectedId("olivia");
    setMobileNav(false);
  }

  async function addEntry(formData: FormData) {
    const type = String(formData.get("type")) as LedgerItem["type"];
    const rawAmount = Number(formData.get("amount"));
    const amount = type === "Payment" ? -Math.abs(rawAmount) : type === "Adjustment" ? rawAmount : Math.abs(rawAmount);
    const entry: LedgerItem = {
      id: `demo-${Date.now()}`,
      date: String(formData.get("date")),
      type,
      description: String(formData.get("description")),
      amount,
      rate: type === "Payment" ? null : Number(formData.get("rate") || selected.rate),
    };
    if (!demoMode) {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selected.id,
          type: type.toUpperCase(),
          effectiveAt: entry.date,
          description: entry.description,
          amount: rawAmount,
          rate: entry.rate,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(result.error ?? "Unable to save the transaction.");
        return;
      }
      entry.id = result.id;
    }
    setChildren((current) =>
      current.map((child) =>
        child.id === selected.id ? { ...child, entries: [...child.entries, entry] } : child,
      ),
    );
    setModal(null);
    notify(`${type} added to ${selected.name.split(" ")[0]}'s ledger`);
  }

  async function updateEntry(formData: FormData) {
    if (!editingEntry) return;
    const type = String(formData.get("type")) as LedgerItem["type"];
    const rawAmount = Number(formData.get("amount"));
    const amount = type === "Payment" ? -Math.abs(rawAmount) : type === "Adjustment" ? rawAmount : Math.abs(rawAmount);
    const updated: LedgerItem = {
      ...editingEntry,
      date: String(formData.get("date")),
      type,
      description: String(formData.get("description")),
      amount,
      rate: type === "Payment" ? null : Number(formData.get("rate") || selected.rate),
    };
    if (!demoMode) {
      const response = await fetch(`/api/transactions/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: type.toUpperCase(),
          effectiveAt: updated.date,
          description: updated.description,
          amount: rawAmount,
          rate: updated.rate,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(result.error ?? "Unable to update the transaction.");
        return;
      }
    }
    setChildren((current) =>
      current.map((child) =>
        child.id === selected.id
          ? { ...child, entries: child.entries.map((entry) => entry.id === updated.id ? updated : entry) }
          : child,
      ),
    );
    setEditingEntry(null);
    setModal(null);
    notify("Transaction updated");
  }

  async function removeEntry(entry: LedgerItem) {
    if (!window.confirm(`Remove this ${entry.type.toLowerCase()} entry from the ledger? This cannot be undone.`)) return;
    if (!demoMode) {
      const response = await fetch(`/api/transactions/${entry.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(result.error ?? "Unable to remove the transaction.");
        return;
      }
    }
    setChildren((current) =>
      current.map((child) =>
        child.id === selected.id
          ? { ...child, entries: child.entries.filter((item) => item.id !== entry.id) }
          : child,
      ),
    );
    notify("Transaction removed");
  }

  function editEntry(entry: LedgerItem) {
    setEditingEntry(entry);
    setModal("edit");
  }

  async function addChild(formData: FormData) {
    const name = String(formData.get("name"));
    let id = name.toLowerCase().replace(/\W+/g, "-");
    if (!demoMode) {
      const response = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: formData.get("email"),
          relationship: formData.get("purpose"),
          annualRate: Number(formData.get("rate")),
          temporaryPassword: formData.get("temporaryPassword"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(result.error ?? "Unable to create the child account.");
        return;
      }
      id = result.id;
    }
    const next: DemoChild = {
      id,
      name,
      initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      email: String(formData.get("email")),
      purpose: String(formData.get("purpose")),
      rate: Number(formData.get("rate")),
      accent: "#81C784",
      entries: [],
    };
    setChildren((current) => [...current, next]);
    setSelectedId(id);
    setModal(null);
    notify(`${name} was added`);
  }

  async function postInterest() {
    let amount = interestPeriod.calculation.total;
    let description = `APR interest · ${interestPeriod.periodStart} to ${interestPeriod.periodEnd} · ${interestPeriod.calculation.segments.length} balance period${interestPeriod.calculation.segments.length === 1 ? "" : "s"}`;
    let id = `interest-${Date.now()}`;
    if (!demoMode) {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selected.id,
          periodStart: interestPeriod.periodStart,
          periodEnd: interestPeriod.periodEnd,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(result.error ?? "Unable to post APR interest.");
        return;
      }
      amount = Number(result.amount);
      description = result.description;
      id = result.id;
    }
    const entry: LedgerItem = {
      id,
      date: interestPeriod.periodEnd,
      type: "Interest",
      description,
      amount,
      rate: selected.rate,
    };
    setChildren((current) =>
      current.map((child) =>
        child.id === selected.id ? { ...child, entries: [...child.entries, entry] } : child,
      ),
    );
    setModal(null);
    notify(`${money.format(amount)} APR interest posted`);
  }

  function exportLedger() {
    const header = "Date,Type,Description,Rate,Amount,Balance\n";
    const rows = selectedLedger
      .map((entry) =>
        [entry.date, entry.type, `"${entry.description}"`, entry.rate ?? "", entry.amount, entry.balance].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([header + rows], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.id}-ledger.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Ledger exported as CSV");
  }

  return (
    <main className="app-shell">
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-top">
          <Link href="/" className="brand app-brand">
            <Image src="/kinledger-logo.png" alt="" width={45} height={45} priority />
            <span>KinLedger</span>
          </Link>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X /></button>
        </div>

        {demoMode && <div className="demo-role-card">
          <span><Sparkles size={14} /> Demo workspace</span>
          <div className="role-toggle">
            <button className={role === "parent" ? "active" : ""} onClick={() => switchRole("parent")}>Parent</button>
            <button className={role === "child" ? "active" : ""} onClick={() => switchRole("child")}>Child</button>
          </div>
        </div>}

        <nav className="side-nav">
          <span className="side-label">Workspace</span>
          <button className="active"><LayoutDashboard size={19} /> Overview</button>
          <button><ReceiptText size={19} /> All transactions</button>
          {role === "parent" && <button><Users size={19} /> Family access</button>}
          <button><Settings size={19} /> Settings</button>
        </nav>

        <div className="sidebar-family">
          <div className="side-label-row">
            <span className="side-label">Family accounts</span>
            {role === "parent" && <button onClick={() => setModal("child")} aria-label="Add child"><Plus size={16} /></button>}
          </div>
          {children.map((child) => {
            const balance = ledgers.get(child.id)?.at(-1)?.balance ?? 0;
            const hidden = role === "child" && child.id !== "olivia";
            if (hidden) return null;
            return (
              <button
                key={child.id}
                className={`child-nav-item ${selected.id === child.id ? "selected" : ""}`}
                onClick={() => { setSelectedId(child.id); setMobileNav(false); }}
              >
                <i style={{ background: `${child.accent}22`, color: child.accent }}>{child.initials}</i>
                <span>{child.name.split(" ")[0]}<small>{money.format(balance)}</small></span>
                {role === "child" && <LockKeyhole size={13} />}
              </button>
            );
          })}
        </div>

        <div className="sidebar-account">
          <div className="avatar">{role === "parent" ? "JB" : selected.initials}</div>
          <span><strong>{role === "parent" ? "James Bennett" : selected.name}</strong><small>{role === "parent" ? "Family admin" : "Read-only member"}</small></span>
          <ChevronDown size={16} />
        </div>
      </aside>

      <section className="app-main">
        <header className="app-header">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></button>
          <div>
            <span className="breadcrumb">Bennett Family <b>/</b> {selected.name.split(" ")[0]}&apos;s loan</span>
            <h1>{role === "parent" ? "Good morning, James" : `Hello, ${selected.name.split(" ")[0]}`}</h1>
          </div>
          <div className="header-actions">
            {demoMode && (
              <Link href="/" className="button button-soft"><ArrowLeft size={17} /> Back to home</Link>
            )}
            <button className="icon-button"><Search size={20} /></button>
            <button className="icon-button notification"><Bell size={20} /><i /></button>
            {demoMode && role === "parent" && (
              <button className="button button-gold" onClick={() => setModal("child")}><UserPlus size={17} /> Add child</button>
            )}
            {role === "parent" && children.length > 0 && (
              <button className="button button-primary" onClick={() => setModal("entry")}><Plus size={17} /> Add entry</button>
            )}
          </div>
        </header>

        {role === "child" && (
          <div className="readonly-banner">
            <span><Eye size={18} /></span>
            <div><strong>Your view is read only</strong><small>You can review every balance and entry. Only your family administrators can make changes.</small></div>
            <LockKeyhole size={18} />
          </div>
        )}

        <section className="dashboard-content">
          {role === "parent" && children.length === 0 ? (
            <div className="empty-workspace">
              <span><Users size={30} /></span>
              <p className="section-kicker">Your family workspace is approved</p>
              <h2>Create your first child account</h2>
              <p>
                Add the child receiving the loan, choose their starting interest rate,
                and create temporary read-only login credentials.
              </p>
              <button className="button button-primary button-large" onClick={() => setModal("child")}>
                <Plus size={18} /> Add your first child
              </button>
              <small><LockKeyhole size={15} /> Child accounts can view their own ledger but cannot change balances.</small>
            </div>
          ) : (
          <>
          <div className="account-heading">
            <div>
              <span className="section-kicker">{role === "parent" ? "Selected account" : "Your loan account"}</span>
              <h2>{selected.name}</h2>
              <p>{selected.purpose} · Opened {new Date(selected.entries[0]?.date ?? "2026-01-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
            <div className="account-actions">
              <button className="button button-soft" onClick={exportLedger}><Download size={17} /> Export</button>
              {role === "parent" && <button className="button button-gold" onClick={() => setModal("interest")}><CircleDollarSign size={17} /> Calculate interest</button>}
            </div>
          </div>

          <div className="metric-grid">
            <article className="metric-card balance-card">
              <div className="metric-icon"><WalletCards size={21} /></div>
              <span>Current balance</span>
              <strong>{money.format(selectedBalance)}</strong>
              <small><ArrowDownLeft size={14} /> {money.format(Math.abs(selected.entries.filter((e) => e.type === "Payment").reduce((n, e) => n + e.amount, 0)))} repaid</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon sage"><CircleDollarSign size={21} /></div>
              <span>APR interest rate</span>
              <strong>{selected.rate.toFixed(2)}% APR</strong>
              <small>Accrued daily at APR ÷ 365</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon gold"><CalendarDays size={21} /></div>
              <span>Next interest posting</span>
              <strong>{new Date(`${interestPeriod.periodEnd}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</strong>
              <small>Admin-selected monthly date</small>
            </article>
            <article className="metric-card">
              <div className="metric-icon silver"><ReceiptText size={21} /></div>
              <span>Estimated next interest</span>
              <strong>{money.format(interestPeriod.calculation.total)}</strong>
              <small>Uses each dated balance interval</small>
            </article>
          </div>

          <div className="dashboard-grid">
            <article className="panel ledger-panel">
              <div className="panel-header">
                <div><h3>Account ledger</h3><p>Every transaction and interest posting</p></div>
                <button className="icon-button"><MoreHorizontal /></button>
              </div>
              <div className="ledger-table-wrap">
                <table className="ledger-table">
                  <thead><tr><th>Date</th><th>Details</th><th>Rate</th><th>Amount</th><th>Balance</th>{role === "parent" && <th><span className="sr-only">Actions</span></th>}</tr></thead>
                  <tbody>
                    {[...selectedLedger].reverse().map((entry) => (
                      <tr key={entry.id}>
                        <td>{new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td>
                          <div className={`entry-icon ${entry.type.toLowerCase()}`}>
                            {entry.type === "Payment" ? <ArrowDownLeft /> : entry.type === "Interest" ? <CircleDollarSign /> : <ArrowUpRight />}
                          </div>
                          <span><strong>{entry.type}</strong><small>{entry.description}</small></span>
                        </td>
                        <td>{entry.rate ? `${entry.rate.toFixed(2)}%` : "—"}</td>
                        <td className={entry.amount < 0 ? "payment-amount" : ""}>{entry.amount < 0 ? "−" : "+"}{money.format(Math.abs(entry.amount))}</td>
                        <td><strong>{money.format(entry.balance)}</strong></td>
                        {role === "parent" && (
                          <td>
                            <div className="transaction-actions">
                              <button onClick={() => editEntry(entry)} aria-label={`Edit ${entry.description}`} title="Edit transaction"><Pencil size={14} /></button>
                              <button className="danger" onClick={() => removeEntry(entry)} aria-label={`Remove ${entry.description}`} title="Remove transaction"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {!selectedLedger.length && <tr><td colSpan={role === "parent" ? 6 : 5} className="empty-cell">No ledger entries yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="panel-footer"><span>Showing {selectedLedger.length} entries</span><button onClick={exportLedger}>Download full ledger</button></div>
            </article>

            <aside className="dashboard-side">
              <article className="panel payment-progress">
                <div className="panel-header"><div><h3>Loan snapshot</h3><p>Progress since opening</p></div></div>
                <div className="ring" style={{ "--progress": "31%" } as React.CSSProperties}>
                  <div><strong>31%</strong><span>repaid</span></div>
                </div>
                <div className="snapshot-row"><span>Original principal</span><strong>{money.format(selected.entries.filter(e => e.type === "Loan").reduce((n, e) => n + e.amount, 0))}</strong></div>
                <div className="snapshot-row"><span>Total payments</span><strong className="green">{money.format(Math.abs(selected.entries.filter(e => e.type === "Payment").reduce((n, e) => n + e.amount, 0)))}</strong></div>
                <div className="snapshot-row"><span>Interest posted</span><strong>{money.format(selected.entries.filter(e => e.type === "Interest").reduce((n, e) => n + e.amount, 0))}</strong></div>
              </article>

              <article className="next-event">
                <div className="next-event-icon"><CalendarDays /></div>
                <div><span>Next scheduled event</span><strong>APR interest posting</strong><small>{displayDate(interestPeriod.periodEnd)}</small></div>
                <i>{daysUntil(interestPeriod.periodEnd)} days</i>
              </article>

              {role === "parent" && (
                <article className="portfolio-note">
                  <ShieldCheck size={20} />
                  <div><strong>Family portfolio</strong><span>{money.format(totalBalance)} outstanding across {children.length} accounts. {money.format(payments)} has been repaid.</span></div>
                </article>
              )}
            </aside>
          </div>
          </>
          )}
        </section>
      </section>

      {modal === "entry" && (
        <Modal title={`Add entry for ${selected.name.split(" ")[0]}`} subtitle="Record a loan, payment, or adjustment." onClose={() => setModal(null)}>
          <form action={addEntry} className="modal-form">
            <div className="field-grid">
              <label>Entry type<select name="type" defaultValue="Payment"><option>Payment</option><option>Loan</option><option>Adjustment</option></select></label>
              <label>Effective date<input name="date" type="date" defaultValue="2026-07-24" required /></label>
            </div>
            <label>Amount<input name="amount" type="number" step="0.01" placeholder="500.00 or -500.00" required /><small className="field-help">For an adjustment, use a negative amount to reduce the balance—for example, −500 for a $500 gift.</small></label>
            <label>Description<input name="description" placeholder="Monthly payment" required /></label>
            <label>Annual interest rate (%)<input name="rate" type="number" min="0" step="0.001" defaultValue={selected.rate} /></label>
            <div className="modal-actions"><button type="button" className="button button-soft" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary">Save entry</button></div>
          </form>
        </Modal>
      )}

      {modal === "edit" && editingEntry && (
        <Modal title="Edit transaction" subtitle="Correct this ledger line and recalculate every following balance." onClose={() => { setEditingEntry(null); setModal(null); }}>
          <form action={updateEntry} className="modal-form">
            <div className="field-grid">
              <label>Entry type<select name="type" defaultValue={editingEntry.type}><option>Payment</option><option>Loan</option><option>Interest</option><option>Adjustment</option></select></label>
              <label>Effective date<input name="date" type="date" defaultValue={editingEntry.date} required /></label>
            </div>
            <label>Amount<input name="amount" type="number" step="0.01" defaultValue={editingEntry.amount} required /><small className="field-help">Negative adjustments reduce the child’s balance; positive adjustments increase it.</small></label>
            <label>Description<input name="description" defaultValue={editingEntry.description} required /></label>
            <label>Annual interest rate (%)<input name="rate" type="number" min="0" step="0.001" defaultValue={editingEntry.rate ?? selected.rate} /></label>
            <div className="modal-actions"><button type="button" className="button button-soft" onClick={() => { setEditingEntry(null); setModal(null); }}>Cancel</button><button className="button button-primary">Save changes</button></div>
          </form>
        </Modal>
      )}

      {modal === "child" && (
        <Modal title="Add a child account" subtitle="Create their ledger and invite them to a read-only view." onClose={() => setModal(null)}>
          <form action={addChild} className="modal-form">
            <label>Full name<input name="name" placeholder="Alex Bennett" required /></label>
            <label>Email address<input name="email" type="email" placeholder="alex@example.com" required /></label>
            <label>Loan purpose<input name="purpose" placeholder="Home renovation" required /></label>
            <label>Annual interest rate (%)<input name="rate" type="number" min="0" step="0.001" defaultValue="3.75" required /></label>
            {!demoMode && <label>Temporary password<input name="temporaryPassword" type="password" minLength={12} placeholder="12+ characters" required /></label>}
            <div className="invite-note"><LockKeyhole size={16} /> The child will only see their own account and cannot make changes.</div>
            <div className="modal-actions"><button type="button" className="button button-soft" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary">Create account</button></div>
          </form>
        </Modal>
      )}

      {modal === "interest" && (
        <Modal title="Calculate APR interest" subtitle={`Review the exact daily accrual for ${selected.name.split(" ")[0]}.`} onClose={() => setModal(null)}>
          <div className="interest-summary">
            <div><span>Current balance</span><strong>{money.format(selectedBalance)}</strong></div>
            <div><span>Annual percentage rate</span><strong>{selected.rate.toFixed(2)}% APR</strong></div>
            <div><span>Interest period</span><strong>{displayDate(interestPeriod.periodStart)} – {displayDate(interestPeriod.periodEnd)}</strong></div>
            <div><span>Dated balance intervals</span><strong>{interestPeriod.calculation.segments.length}</strong></div>
            <div className="interest-total"><span>APR interest to post</span><strong>{money.format(interestPeriod.calculation.total)}</strong></div>
          </div>
          <p className="calculation-note"><HandCoins size={17} /> Interest is APR ÷ 365 for each day. A loan starts accruing on its loan date; a payment or gift reduces the interest-bearing balance on its effective date, including partial months.</p>
          <div className="modal-actions"><button className="button button-soft" onClick={() => setModal(null)}>Reset</button><button className="button button-primary" disabled={interestPeriod.calculation.total <= 0} onClick={postInterest}>Calculate & post APR interest</button></div>
        </Modal>
      )}
    </main>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        {children}
      </section>
    </div>
  );
}
