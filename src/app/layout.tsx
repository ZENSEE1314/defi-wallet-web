import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BlockchainBackgroundClient } from "@/components/BlockchainBackgroundClient";

const SITE_URL = "https://defi-wallet-web.vercel.app";
const DESCRIPTION =
  "Self-custody multi-chain crypto wallet that runs in your browser. Connect to any dApp via WalletConnect v2. Supports Ethereum, Base, Arbitrum, Optimism, Polygon, BSC. Biometric unlock, QR scan, encrypted keystore.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DeFi Wallet — Self-custody multi-chain web wallet",
    template: "%s · DeFi Wallet"
  },
  description: DESCRIPTION,
  applicationName: "DeFi Wallet",
  authors: [{ name: "ZENSEE1314", url: "https://github.com/ZENSEE1314" }],
  generator: "Next.js",
  keywords: [
    "DeFi wallet",
    "crypto wallet",
    "web3 wallet",
    "WalletConnect",
    "multi-chain wallet",
    "Ethereum wallet",
    "Base wallet",
    "BSC wallet",
    "Arbitrum wallet",
    "Polygon wallet",
    "non-custodial wallet",
    "browser wallet",
    "self-custody",
    "biometric wallet"
  ],
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 }
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "DeFi Wallet",
    title: "DeFi Wallet — Self-custody multi-chain web wallet",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US"
  },
  twitter: {
    card: "summary_large_image",
    title: "DeFi Wallet — Self-custody multi-chain web wallet",
    description: DESCRIPTION,
    creator: "@ZENSEE1314"
  },
  category: "finance"
};

export const viewport: Viewport = {
  themeColor: "#0a0d1a",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark"
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "DeFi Wallet",
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any (browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Self-custody key management",
    "Multi-chain (Ethereum, Base, Arbitrum, Optimism, Polygon, BSC)",
    "WalletConnect v2",
    "Biometric unlock (WebAuthn)",
    "Encrypted browser keystore",
    "QR code scanning"
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body className="text-text">
        <BlockchainBackgroundClient />
        {children}
      </body>
    </html>
  );
}
