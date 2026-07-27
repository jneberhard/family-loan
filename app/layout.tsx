import type { Metadata, Viewport } from "next";
import { Manrope, Newsreader } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "KinLedger — Family loans, clearly managed", template: "%s · KinLedger" },
  description:
    "A private, transparent family loan ledger for parents and their children.",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  openGraph: {
    title: "KinLedger — Family loans, clearly managed",
    description: "Private family loan ledgers with clear balances, automatic interest, and respectful access.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "KinLedger family loan dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "KinLedger — Family loans, clearly managed",
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
