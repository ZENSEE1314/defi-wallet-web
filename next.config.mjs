/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't block the production build on lint warnings — TS errors still fail.
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    // WalletConnect ships ESM that touches optional Node peers. Tell webpack to
    // skip them — they're only needed in environments we don't target.
    config.externals = [...(config.externals || []), "pino-pretty", "lokijs", "encoding"];
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    if (!isServer) {
      // Some WalletConnect deps reference Node modules from the browser bundle —
      // alias them to false so webpack drops the imports.
      config.resolve.alias = { ...config.resolve.alias, "pino-pretty": false };
    }
    return config;
  }
};

export default nextConfig;
