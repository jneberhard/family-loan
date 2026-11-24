import type { Metadata } from "next";

export const siteUrl = new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "https://familyloanledger.com");

export function publicPageMetadata(path: string, title: string, description: string): Metadata {
  const url = new URL(path, siteUrl).toString();
  const socialTitle = `${title} · Family Loan Ledger`;
  const images = [{
    url: new URL("/og.png", siteUrl).toString(),
    width: 1729,
    height: 910,
    alt: "Family Loan Ledger family loan dashboard",
  }];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, url, siteName: "Family Loan Ledger", locale: "en_US", type: "website", images },
    twitter: { card: "summary_large_image", title: socialTitle, description, images },
  };
}

export const privatePageRobots: Metadata["robots"] = { index: false, follow: false };

export const publicPagePaths = ["/", "/pricing", "/become-parent", "/demo", "/guide", "/privacy", "/terms", "/legal", "/delete-account"] as const;
