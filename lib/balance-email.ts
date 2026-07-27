import { Resend } from "resend";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendBalanceEmail({
  childName,
  childEmail,
  familyName,
  balance,
  apr,
  asOf,
  idempotencyKey,
}: {
  childName: string;
  childEmail: string;
  familyName: string;
  balance: number;
  apr: number;
  asOf: string;
  idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_NOT_CONFIGURED");

  const formattedBalance = money.format(balance);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const signInLine = appUrl ? `\nReview your ledger: ${appUrl}/login` : "";
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
    {
      from: process.env.RESEND_FROM_EMAIL ?? "KinLedger <onboarding@resend.dev>",
      to: [childEmail],
      subject: `${familyName} loan balance: ${formattedBalance}`,
      text: [
        `Hello ${childName},`,
        "",
        `Your current ${familyName} family-loan balance is ${formattedBalance} as of ${asOf}.`,
        `Current annual percentage rate: ${apr.toFixed(3)}% APR.`,
        signInLine,
        "",
        "This balance is provided for your records. Please contact your family administrator with questions.",
        "",
        "KinLedger",
      ].filter(Boolean).join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#2D3748">
          <div style="border:1px solid #E5E7EB;border-radius:16px;overflow:hidden">
            <div style="background:#2E7D32;color:white;padding:24px 28px">
              <div style="font-size:13px;opacity:.85">${escapeHtml(familyName)} family loan</div>
              <h1 style="font-size:28px;margin:8px 0 0">Current balance</h1>
            </div>
            <div style="padding:28px">
              <p>Hello ${escapeHtml(childName)},</p>
              <p>Your current family-loan balance as of ${escapeHtml(asOf)} is:</p>
              <div style="font-size:34px;font-weight:700;color:#2E7D32;margin:22px 0">${formattedBalance}</div>
              <p><strong>Interest rate:</strong> ${apr.toFixed(3)}% APR</p>
              ${appUrl ? `<p><a href="${escapeHtml(`${appUrl}/login`)}" style="display:inline-block;background:#D4AF37;color:#292816;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700">Review your ledger</a></p>` : ""}
              <p style="color:#6B7280;font-size:13px;margin-top:28px">This balance is provided for your records. Please contact your family administrator with questions.</p>
            </div>
          </div>
        </div>
      `,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (error) {
    console.error("Resend balance email error:", error.name);
    throw new Error("EMAIL_SEND_FAILED");
  }
}
