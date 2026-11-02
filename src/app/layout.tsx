import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "RUNNER — Discover the Next Runner", template: "%s · RUNNER" },
  description:
    "RUNNER is a curated Solana memecoin rewards ecosystem. Discover emerging Solana projects through independently screened campaigns and proportional token distributions.",
  openGraph: {
    title: "RUNNER — Discover the Next Runner",
    description: "One token. Multiple opportunities. Curated Solana token distributions.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
