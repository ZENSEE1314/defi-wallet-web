// Per-chain default token list. USDT is auto-added for every chain that has one.

export type TokenInfo = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  isDefault?: boolean; // shown without user opting in
};

export const BUILTIN_TOKENS: Record<number, TokenInfo[]> = {
  1: [
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", name: "Tether USD", decimals: 6, isDefault: true },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", name: "USD Coin", decimals: 6, isDefault: true },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", name: "Dai", decimals: 18 }
  ],
  56: [
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", name: "Tether USD", decimals: 18, isDefault: true },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", name: "USD Coin", decimals: 18, isDefault: true },
    { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD", name: "Binance USD", decimals: 18 }
  ],
  8453: [
    { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", symbol: "USDT", name: "Tether USD", decimals: 6, isDefault: true },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", name: "USD Coin", decimals: 6, isDefault: true }
  ],
  42161: [
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", name: "Tether USD", decimals: 6, isDefault: true },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", name: "USD Coin", decimals: 6, isDefault: true }
  ],
  10: [
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", name: "Tether USD", decimals: 6, isDefault: true },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", name: "USD Coin", decimals: 6, isDefault: true }
  ],
  137: [
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", name: "Tether USD", decimals: 6, isDefault: true },
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", name: "USD Coin", decimals: 6, isDefault: true }
  ]
};

export function getDefaultTokens(chainId: number): TokenInfo[] {
  return (BUILTIN_TOKENS[chainId] ?? []).filter((t) => t.isDefault);
}

export function getAllBuiltins(chainId: number): TokenInfo[] {
  return BUILTIN_TOKENS[chainId] ?? [];
}
