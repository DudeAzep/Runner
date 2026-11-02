import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { SolanaWalletProvider } from "@/components/wallet/SolanaWalletProvider";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink-800 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Navbar />
      <main id="main">{children}</main>
      <Footer />
    </SolanaWalletProvider>
  );
}
