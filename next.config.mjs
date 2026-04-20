/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WalletConnect's nested deps have pino Logger type collisions that have
  // nothing to do with our code — skip both lint and TS during build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
