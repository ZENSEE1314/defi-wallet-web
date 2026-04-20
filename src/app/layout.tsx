import type { Metadata } from "next";
import "./globals.css";
import { BlockchainBackground } from "@/components/BlockchainBackground";

export const metadata: Metadata = {
  title: "DeFi Wallet",
  description: "Multi-chain web wallet with WalletConnect"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-text">
        <BlockchainBackground />
        {children}
      </body>
    </html>
  );
}
