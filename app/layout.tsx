import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://familyloanledger.com"),
  title: { default: "Family Loan Ledger — Family loans, clearly managed", template: "%s · Family Loan Ledger" },
  description:
    "A private, transparent family loan ledger for parents and their children.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  openGraph: {
    title: "Family Loan Ledger — Family loans, clearly managed",
    description: "Private family loan ledgers with clear balances, automatic interest, and respectful access.",
    type: "website",
    images: [{ url: "/og.png", width: 1729, height: 910, alt: "Family Loan Ledger family loan dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Family Loan Ledger — Family loans, clearly managed",
    description: "A private, transparent family loan ledger.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${newsreader.variable}`}>{children}</body>
    </html>
  );
}
