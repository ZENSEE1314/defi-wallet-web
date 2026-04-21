// USD pricing via Dexscreener — picks the most-liquid pair for each token,
// caches results for 60s to avoid hammering the public API.

export type Prices = Record<string, number>; // token addr (lowercase) → USD price

const CACHE_MS = 60_000;
const cache = new Map<string, { price: number; ts: number }>();

// Wrapped-native addresses we use as the price proxy for the native asset on each chain.
export const NATIVE_PROXY_BY_CHAIN: Record<number, string> = {
  1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",       // WETH
  56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",      // WBNB
  8453: "0x4200000000000000000000000000000000000006",    // WETH (Base)
  42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",   // WETH (Arbitrum)
  10: "0x4200000000000000000000000000000000000006",      // WETH (Optimism)
  137: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"      // WMATIC
};

// Stablecoin addresses pinned to $1 — saves an API call and avoids tiny depeg noise
const STABLECOINS = new Set([
  "0x55d398326f99059ff775485246999027b3197955", // USDT BSC
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC BSC
  "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
  "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT ETH
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC ETH
  "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", // USDT Base
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC Base
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT Arbitrum
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC Arbitrum
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT Optimism
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC Optimism
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT Polygon
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"  // USDC Polygon
]);

export async function getPrice(chainId: number, tokenAddress: string): Promise<number> {
  const key = `${chainId}:${tokenAddress.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_MS) return cached.price;

  if (STABLECOINS.has(tokenAddress.toLowerCase())) {
    cache.set(key, { price: 1, ts: Date.now() });
    return 1;
  }

  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
    if (!r.ok) return 0;
    const d = (await r.json()) as { pairs?: { chainId: string; priceUsd?: string; liquidity?: { usd?: number } }[] };
    const chainName = chainNameFromId(chainId);
    const pairs = (d.pairs ?? [])
      .filter((p) => p.chainId === chainName && p.priceUsd)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const price = pairs.length > 0 ? Number(pairs[0].priceUsd) : 0;
    cache.set(key, { price, ts: Date.now() });
    return price;
  } catch {
    return 0;
  }
}

export async function getPrices(chainId: number, tokenAddresses: string[]): Promise<Prices> {
  const unique = Array.from(new Set(tokenAddresses.map((a) => a.toLowerCase())));
  const entries = await Promise.all(
    unique.map(async (addr) => [addr, await getPrice(chainId, addr)] as const)
  );
  return Object.fromEntries(entries);
}

function chainNameFromId(id: number): string {
  switch (id) {
    case 1: return "ethereum";
    case 56: return "bsc";
    case 8453: return "base";
    case 42161: return "arbitrum";
    case 10: return "optimism";
    case 137: return "polygon";
    default: return "";
  }
}

export function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(2)}k`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}
