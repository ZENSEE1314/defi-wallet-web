// Etherscan v2 unified API — works across every supported EVM chain with a
// single endpoint. Free tier works without a key but is heavily rate-limited.
// Add NEXT_PUBLIC_ETHERSCAN_API_KEY in Vercel env to lift the limits.

const BASE = "https://api.etherscan.io/v2/api";

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
  const params = new URLSearchParams({
    chainid: String(chainId),
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
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error(`explorer ${res.status}`);
  const data = (await res.json()) as { status: string; message: string; result: RawTx[] | string };
  if (data.status !== "1") {
    // "No transactions found" returns status 0 — treat as empty list
    if (typeof data.result === "string") return [];
    if (data.message?.toLowerCase().includes("no transactions")) return [];
    throw new Error(typeof data.result === "string" ? data.result : data.message);
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
