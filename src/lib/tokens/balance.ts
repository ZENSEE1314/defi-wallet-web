import { Contract, JsonRpcProvider, formatUnits } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export async function getErc20Balance(provider: JsonRpcProvider, token: string, owner: string, decimals: number): Promise<string> {
  const c = new Contract(token, ERC20_ABI, provider);
  const raw = (await c.balanceOf(owner)) as bigint;
  return formatUnits(raw, decimals);
}

export async function getErc20Metadata(provider: JsonRpcProvider, token: string): Promise<{ symbol: string; name: string; decimals: number }> {
  const c = new Contract(token, ERC20_ABI, provider);
  const [symbol, name, decimals] = await Promise.all([
    c.symbol() as Promise<string>,
    c.name() as Promise<string>,
    c.decimals() as Promise<bigint>
  ]);
  return { symbol, name, decimals: Number(decimals) };
}
