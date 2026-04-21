// Per-chain explorer APIs. The Etherscan V2 unified endpoint requires a paid
// plan for non-Ethereum chains, so we hit each chain's own free endpoint.
// All accept the same Etherscan-format params + the same NEXT_PUBLIC_ETHERSCAN_API_KEY
// works on most of them (etherscan accounts are now unified across chains).

const EXPLORER_API_BY_CHAIN: Record<number, string> = {
  1: "https://api.etherscan.io/api",
  56: "https://api.bscscan.com/api",
  137: "https://api.polygonscan.com/api",
  42161: "https://api.arbiscan.io/api",
  10: "https://api-optimistic.etherscan.io/api",
  8453: "https://api.basescan.org/api",
  11155111: "https://api-sepolia.etherscan.io/api"
};

export type TxRow = {
  hash: string;
  from: string;
  to: string;
  valueWei: string;
  symbol: string; // "BNB"/"ETH"/etc. for native, or token symbol for ERC-20
  decimals: number;
  timestamp: number; // ms
  blockNumber: number;
  isError: boolean;
  kind: "native" | "erc20";
};

type RawTx = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  isError?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
};

async function call(chainId: number, action: string, address: string, extra: Record<string, string> = {}): Promise<RawTx[]> {
  const base = EXPLORER_API_BY_CHAIN[chainId];
  if (!base) throw new Error(`No explorer API configured for chain ${chainId}`);
  const params = new URLSearchParams({
    module: "account",
    action,
    address,
    page: "1",
    offset: "25",
    sort: "desc",
    ...extra
  });
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
  if (apiKey) params.set("apikey", apiKey);
  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const data = (await res.json()) as { status: string; message: string; result: RawTx[] | string };
  if (data.status !== "1") {
    if (typeof data.result === "string") {
      // "No transactions found" → empty list, that's fine
      if (data.result.toLowerCase().includes("no transactions")) return [];
      // Anything else (rate limit, deprecated endpoint, etc.) is a real error
      throw new Error(data.result.slice(0, 160));
    }
    if (data.message?.toLowerCase().includes("no transactions")) return [];
    throw new Error(data.message ?? "explorer error");
  }
  return Array.isArray(data.result) ? data.result : [];
}

export async function fetchHistory(chainId: number, address: string, nativeSymbol: string): Promise<TxRow[]> {
  const [normal, tokens] = await Promise.all([
    call(chainId, "txlist", address).catch(() => []),
    call(chainId, "tokentx", address).catch(() => [])
  ]);

  const nativeRows: TxRow[] = normal.map((t) => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    valueWei: t.value,
    symbol: nativeSymbol,
    decimals: 18,
    timestamp: Number(t.timeStamp) * 1000,
    blockNumber: Number(t.blockNumber),
    isError: t.isError === "1",
    kind: "native"
  }));

  const tokenRows: TxRow[] = tokens.map((t) => ({
    hash: t.hash,
    from: t.from,
    to: t.to,
    valueWei: t.value,
    symbol: t.tokenSymbol ?? "?",
    decimals: Number(t.tokenDecimal ?? "18"),
    timestamp: Number(t.timeStamp) * 1000,
    blockNumber: Number(t.blockNumber),
    isError: false,
    kind: "erc20"
  }));

  // Merge & sort newest-first
  return [...nativeRows, ...tokenRows].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
}
