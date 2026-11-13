"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Ban,
  Check,
  Clock3,
  LogOut,
  Search,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";
import { CouponManager } from "@/components/coupon-manager";

type Application = {
  id: string;
  familyName: string;
  parentName: string;
  email: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  childCount: number;
  reviewNote: string | null;
};

type DeletionRequest = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CHILD" | "SUPER_USER";
  source: "IN_APP" | "WEB";
  createdAt: string;
};

export function SuperAdminDashboard({
  initialApplications,
  initialDeletionRequests,
}: {
  initialApplications: Application[];
  initialDeletionRequests: DeletionRequest[];
}) {
  const [applications, setApplications] = useState(initialApplications);
  const [filter, setFilter] = useState<Application["status"] | "ALL">("PENDING");
  const [query, setQuery] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [toast, setToast] = useState("");
  const [deletionRequests, setDeletionRequests] = useState(initialDeletionRequests);

  const visible = useMemo(
    () =>
      applications.filter((application) => {
        const matchesFilter = filter === "ALL" || application.status === filter;
        const haystack = `${application.familyName} ${application.parentName} ${application.email}`.toLowerCase();
        return matchesFilter && haystack.includes(query.toLowerCase());
      }),
    [applications, filter, query],
  );

  const counts = {
    pending: applications.filter((item) => item.status === "PENDING").length,
    approved: applications.filter((item) => item.status === "APPROVED").length,
    rejected: applications.filter((item) => item.status === "REJECTED").length,
  };

  async function review(application: Application, approvalStatus: "APPROVED" | "REJECTED") {
    const reviewNote =
      approvalStatus === "REJECTED"
        ? window.prompt("Optional reason for rejecting this application:") ?? ""
        : "";
    setWorkingId(application.id);
    const response = await fetch(`/api/super-admin/families/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus, reviewNote }),
    });
    const result = await response.json().catch(() => ({}));
    setWorkingId("");
    if (!response.ok) {
      setToast(result.error ?? "Unable to update the application.");
      return;
    }
    setApplications((current) =>
      current.map((item) =>
        item.id === application.id
          ? { ...item, status: result.approvalStatus, reviewNote: result.reviewNote }
          : item,
      ),
    );
    setToast(
      approvalStatus === "APPROVED"
        ? `${application.parentName} can now sign in and create child accounts.`
        : `${application.familyName} was declined.`,
    );
    window.setTimeout(() => setToast(""), 3500);
  }

  async function fulfillDeletion(item: DeletionRequest) {
    if (!window.confirm(`After verifying ${item.email}, complete deletion and anonymize their account? The family's financial ledger will be kept with the requester anonymized.`)) return;
    setWorkingId(item.id);
    const response = await fetch(`/api/super-admin/deletion-requests/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const result = await response.json().catch(() => ({}));
    setWorkingId("");
    if (!response.ok) {
      setToast(
        result.error === "LAST_FAMILY_ADMIN"
          ? "Add another family administrator before completing this deletion."
          : result.error ?? "Unable to complete the deletion request.",
      );
      return;
    }
    setDeletionRequests((current) => current.filter((request) => request.id !== item.id));
    setToast("Account details were removed and the family ledger was retained.");
    window.setTimeout(() => setToast(""), 3500);
  }

  return (
    <main className="super-shell">
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
      <header className="super-header">
        <Link href="/" className="brand">
          <Image src="/family-loan-ledger-logo.png" alt="" width={44} height={44} priority />
          <span>Family Loan Ledger</span>
        </Link>
        <span className="super-badge"><ShieldCheck size={15} /> Super user console</span>
        <Link href="#coupon-management" className="button button-soft super-coupon-link"><Ticket size={15} /> Coupon codes</Link>
        <form action="/api/auth/logout" method="post">
          <button className="button button-soft"><LogOut size={16} /> Sign out</button>
        </form>
      </header>

      <section className="super-content">
        <div className="super-heading">
          <div>
            <span className="section-kicker">Platform administration</span>
            <h1>Parent-lender approvals</h1>
            <p>Review each new family workspace before its parent administrator can sign in.</p>
          </div>
          <div className="super-summary">
            <span><Clock3 /> <strong>{counts.pending}</strong> pending</span>
            <span><BadgeCheck /> <strong>{counts.approved}</strong> approved</span>
            <span><Ban /> <strong>{counts.rejected}</strong> declined</span>
          </div>
        </div>

        <div className="approval-toolbar">
          <div className="approval-tabs">
            {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((status) => (
              <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>
                {status === "ALL" ? "All applications" : status.toLowerCase()}
              </button>
            ))}
          </div>
          <label className="approval-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search families or parents" />
          </label>
        </div>

        <div className="approval-list">
          {visible.map((application) => (
            <article className="approval-card" key={application.id}>
              <div className="approval-avatar">{application.parentName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
              <div className="approval-identity">
                <span className={`status-pill ${application.status.toLowerCase()}`}>{application.status.toLowerCase()}</span>
                <h2>{application.familyName}</h2>
                <p>{application.parentName} · {application.email}</p>
              </div>
              <div className="approval-meta">
                <span><Clock3 size={15} /> Applied {new Date(application.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span><Users size={15} /> {application.childCount} child accounts</span>
              </div>
              {application.reviewNote && <p className="review-note">{application.reviewNote}</p>}
              <div className="approval-actions">
                {application.status === "PENDING" ? (
                  <>
                    <button className="button button-soft" disabled={workingId === application.id} onClick={() => review(application, "REJECTED")}><Ban size={16} /> Decline</button>
                    <button className="button button-primary" disabled={workingId === application.id} onClick={() => review(application, "APPROVED")}><BadgeCheck size={16} /> Approve parent</button>
                  </>
                ) : (
                  <span className={`decision-label ${application.status.toLowerCase()}`}>
                    {application.status === "APPROVED" ? <BadgeCheck size={17} /> : <Ban size={17} />}
                    {application.status === "APPROVED" ? "Parent access enabled" : "Application declined"}
                  </span>
                )}
              </div>
            </article>
          ))}
          {!visible.length && (
            <div className="approval-empty">
              <ShieldCheck size={28} />
              <h2>No applications here</h2>
              <p>New parent-lender applications will appear in this queue.</p>
            </div>
          )}
        </div>

        <section className="deletion-requests">
          <div className="super-heading">
            <div>
              <span className="section-kicker">Privacy requests</span>
              <h2>Account deletion</h2>
              <p>Verify external requests with the requester before completing them. Financial ledger history is retained with identifying details removed.</p>
            </div>
            <div className="super-summary"><span><Clock3 /> <strong>{deletionRequests.length}</strong> pending</span></div>
          </div>
          <div className="approval-list">
            {deletionRequests.map((item) => (
              <article className="approval-card" key={item.id}>
                <div className="approval-avatar">{item.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</div>
                <div className="approval-identity">
                  <span className="status-pill pending">pending</span>
                  <h2>{item.name}</h2>
                  <p>{item.email} · {item.role.toLowerCase()} · {item.source === "IN_APP" ? "in app" : "web request"}</p>
                </div>
                <div className="approval-meta"><span><Clock3 size={15} /> Requested {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
                <div className="approval-actions">
                  <button className="button button-primary" disabled={workingId === item.id} onClick={() => fulfillDeletion(item)}>Verify and delete account</button>
                </div>
              </article>
            ))}
            {!deletionRequests.length && (
              <div className="approval-empty">
                <ShieldCheck size={28} />
                <h2>No deletion requests</h2>
                <p>New account deletion requests will appear here.</p>
              </div>
            )}
          </div>
        </section>
        <CouponManager />
      </section>
    </main>
  );
}
