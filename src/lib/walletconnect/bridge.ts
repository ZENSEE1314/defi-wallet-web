// Wallet-side WalletConnect v2 bridge.
// Pairs with dApps via wc: URI, surfaces session proposals/requests so the UI can approve or reject.

import type { CoreTypes, ProposalTypes } from "@walletconnect/types";
import { JsonRpcProvider, Wallet, HDNodeWallet, getAddress, getBytes } from "ethers";
import { BUILTIN_CHAINS, findChain, type Chain } from "../chains/registry";
import { unlockWallet, deriveSigner, type WalletRecord } from "../wallet/keystore";

// The Web3Wallet runtime type is awkward to import as a type-only binding because
// the package re-exports the class as a value. We hold the singleton internally
// and rely on runtime checks.
type Web3WalletInstance = {
  pair: (args: { uri: string }) => Promise<void>;
  approveSession: (args: { id: number; namespaces: Record<string, unknown> }) => Promise<unknown>;
  rejectSession: (args: { id: number; reason: { code: number; message: string } }) => Promise<unknown>;
  respondSessionRequest: (args: { topic: string; response: { id: number; jsonrpc: "2.0"; result?: unknown; error?: { code: number; message: string } } }) => Promise<unknown>;
  disconnectSession: (args: { topic: string; reason: { code: number; message: string } }) => Promise<unknown>;
  getActiveSessions: () => Record<string, { topic: string; peer: { metadata: CoreTypes.Metadata }; namespaces: Record<string, { chains?: string[] }> }>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
};

let wallet: Web3WalletInstance | null = null;
let pendingProposalHandler: ((p: { id: number; params: ProposalTypes.Struct & { proposer: { metadata: CoreTypes.Metadata } } }) => Promise<void>) | null = null;
let pendingRequestHandler: ((r: { topic: string; id: number; params: { chainId: string; request: { method: string; params: unknown[] } } }) => Promise<void>) | null = null;

export type Hooks = {
  getActiveWallet: () => WalletRecord | null;
  getActiveChain: () => Chain;
  getAllChains: () => Chain[];
  // UI must resolve with the password (or null to reject) when called.
  promptPassword: (info: { method: string; address: string; details?: string }) => Promise<string | null>;
  promptApproveSession: (proposer: CoreTypes.Metadata, chains: number[]) => Promise<boolean>;
  onSessionsChanged: () => void;
};

let hooks: Hooks | null = null;

export async function init(projectId: string, h: Hooks): Promise<void> {
  if (wallet) return;
  hooks = h;

  // Dynamic imports keep the WalletConnect bundle out of the initial page load
  // and avoid SSR — these libraries assume `window`.
  const [{ Core }, { Web3Wallet }] = await Promise.all([
    import("@walletconnect/core"),
    import("@walletconnect/web3wallet")
  ]);

  const core = new Core({ projectId });
  wallet = (await Web3Wallet.init({
    core,
    metadata: {
      name: "DeFi Wallet",
      description: "Multi-chain web wallet",
      url: typeof window !== "undefined" ? window.location.origin : "https://example.com",
      icons: []
    }
  })) as unknown as Web3WalletInstance;

  wallet.on("session_proposal", (p) => pendingProposalHandler?.(p as Parameters<NonNullable<typeof pendingProposalHandler>>[0]));
  wallet.on("session_request", (r) => pendingRequestHandler?.(r as Parameters<NonNullable<typeof pendingRequestHandler>>[0]));

  pendingProposalHandler = handleProposal;
  pendingRequestHandler = handleRequest;
}

export async function pair(uri: string): Promise<void> {
  if (!wallet) throw new Error("WalletConnect not initialised");
  await wallet.pair({ uri });
}

export function getActiveSessions(): { topic: string; peer: CoreTypes.Metadata; chains: string[] }[] {
  if (!wallet) return [];
  return Object.values(wallet.getActiveSessions()).map((s) => ({
    topic: s.topic,
    peer: s.peer.metadata,
    chains: Object.values(s.namespaces).flatMap((n) => n.chains ?? [])
  }));
}

export async function disconnect(topic: string): Promise<void> {
  if (!wallet) return;
  await wallet.disconnectSession({ topic, reason: { code: 6000, message: "User disconnected" } });
  hooks?.onSessionsChanged();
}

type ProposalArg = { id: number; params: ProposalTypes.Struct & { proposer: { metadata: CoreTypes.Metadata } } };
type RequestArg = { topic: string; id: number; params: { chainId: string; request: { method: string; params: unknown[] } } };

async function handleProposal(p: ProposalArg): Promise<void> {
  if (!wallet || !hooks) return;
  const requestedChains = extractRequestedChains(p.params);
  const ok = await hooks.promptApproveSession(p.params.proposer.metadata, requestedChains);
  const active = hooks.getActiveWallet();
  if (!ok || !active) {
    await wallet.rejectSession({ id: p.id, reason: { code: 5000, message: "User rejected" } });
    return;
  }
  const allChains = hooks.getAllChains();
  const supported = requestedChains.filter((id) => findChain(allChains, id));
  if (supported.length === 0) {
    await wallet.rejectSession({ id: p.id, reason: { code: 5100, message: "No supported chain" } });
    return;
  }
  const accounts = supported.map((id) => `eip155:${id}:${getAddress(active.address)}`);
  const namespaces = {
    eip155: {
      chains: supported.map((id) => `eip155:${id}`),
      accounts,
      methods: ["eth_sendTransaction", "personal_sign", "eth_sign", "eth_signTypedData", "eth_signTypedData_v4", "wallet_switchEthereumChain"],
      events: ["accountsChanged", "chainChanged"]
    }
  };
  await wallet.approveSession({ id: p.id, namespaces });
  hooks.onSessionsChanged();
}

function extractRequestedChains(params: ProposalTypes.Struct): number[] {
  const out = new Set<number>();
  for (const ns of [...Object.values(params.requiredNamespaces ?? {}), ...Object.values(params.optionalNamespaces ?? {})]) {
    for (const chain of ns.chains ?? []) {
      const m = chain.match(/^eip155:(\d+)$/);
      if (m) out.add(Number(m[1]));
    }
  }
  return [...out];
}

async function handleRequest(r: RequestArg): Promise<void> {
  if (!wallet || !hooks) return;
  const { topic, params, id } = r;
  const { request, chainId } = params;
  const numericChain = Number(chainId.split(":")[1]);
  const active = hooks.getActiveWallet();
  const allChains = hooks.getAllChains();
  const chain = findChain(allChains, numericChain) ?? findChain(BUILTIN_CHAINS, numericChain);
  if (!active || !chain) {
    await wallet.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", error: { code: -32000, message: "no active wallet/chain" } } });
    return;
  }

  const password = await hooks.promptPassword({
    method: request.method,
    address: active.address,
    details: summariseRequest(request)
  });
  if (!password) {
    await wallet.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", error: { code: 4001, message: "user rejected" } } });
    return;
  }

  try {
    const secret = await unlockWallet(active, password);
    const provider = new JsonRpcProvider(chain.rpcUrl, chain.id);
    const signer = (deriveSigner(secret, active.source) as Wallet | HDNodeWallet).connect(provider);
    const result = await dispatch(signer, request);
    await wallet.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", result } });
  } catch (e) {
    await wallet.respondSessionRequest({ topic, response: { id, jsonrpc: "2.0", error: { code: -32000, message: e instanceof Error ? e.message : "signing failed" } } });
  }
}

function summariseRequest(req: { method: string; params: unknown[] }): string {
  switch (req.method) {
    case "eth_sendTransaction": {
      const tx = req.params[0] as { to?: string; value?: string };
      return `to ${tx.to?.slice(0, 8)}… value ${tx.value ?? "0"}`;
    }
    case "personal_sign":
    case "eth_sign":
      return `message: ${String(req.params[0]).slice(0, 60)}`;
    default:
      return req.method;
  }
}

async function dispatch(signer: Wallet | HDNodeWallet, req: { method: string; params: unknown[] }): Promise<unknown> {
  switch (req.method) {
    case "eth_sendTransaction": {
      const tx = req.params[0] as { to: string; value?: string; data?: string; gas?: string };
      const sent = await signer.sendTransaction({
        to: tx.to,
        value: tx.value ? BigInt(tx.value) : 0n,
        data: tx.data,
        gasLimit: tx.gas ? BigInt(tx.gas) : undefined
      });
      return sent.hash;
    }
    case "personal_sign": {
      const msg = req.params[0] as string;
      const bytes = msg.startsWith("0x") ? getBytes(msg) : msg;
      return signer.signMessage(bytes);
    }
    case "eth_sign":
      return signer.signMessage(req.params[1] as string);
    case "eth_signTypedData":
    case "eth_signTypedData_v4": {
      const typed = JSON.parse(req.params[1] as string);
      return signer.signTypedData(typed.domain, typed.types, typed.message);
    }
    default:
      throw new Error(`unsupported method: ${req.method}`);
  }
}
