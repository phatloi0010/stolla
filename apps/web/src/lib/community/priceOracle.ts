import { contract } from "@stellar/stellar-sdk";
import { requireRpcConfig } from "@/lib/stellar";

export const ADR_266_DECISION_URL =
  "https://github.com/stolla-labs/stolla/issues/266";
export const ADR_266_DOC_PATH =
  "docs/adr/007-price-oracle-scope-and-consumer-spike.md";
export const EXPERIMENTAL_ORACLE_LABEL =
  "Experimental / not for custody — read-only debug feed";

export type PriceOracleQuote = {
  asset: string;
  rawPrice: bigint;
  updatedAtLedger: number;
  feePerSubmission: bigint;
};

export type PriceOracleReadResult =
  | ({ status: "ok" } & PriceOracleQuote)
  | {
      status: "unset-feed";
      asset: string;
      message: string;
    }
  | {
      status: "rpc-error";
      asset: string;
      message: string;
    };

export type PriceOracleAdapter = {
  readFeed: (
    oracleContractId: string,
    assetSymbol: string,
  ) => Promise<PriceOracleReadResult>;
};

export function isValidOracleContractId(
  contractId: string | null | undefined,
): contractId is string {
  if (!contractId) return false;
  return /^C[A-Z2-7]{55}$/.test(contractId.trim());
}

export function resolveConfiguredOracleContractId(
  explicitContractId?: string | null,
): string | null {
  const candidate =
    explicitContractId ??
    process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID ??
    null;
  if (!candidate) return null;
  const trimmed = candidate.trim();
  return isValidOracleContractId(trimmed) ? trimmed : null;
}

export function normalizeOracleAssetSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
  return cleaned || "XLM_USDC";
}

export function interpretOracleFeedSnapshot(params: {
  asset: string;
  rawPrice: bigint;
  updatedAtLedger: number;
  feePerSubmission?: bigint;
}): PriceOracleReadResult {
  const asset = normalizeOracleAssetSymbol(params.asset);
  if (params.rawPrice <= 0n || params.updatedAtLedger <= 0) {
    return {
      status: "unset-feed",
      asset,
      message: `Feed "${asset}" has no published price on this oracle contract yet. Submit an initial price from an authorized relayer or choose a configured asset symbol.`,
    };
  }

  return {
    status: "ok",
    asset,
    rawPrice: params.rawPrice,
    updatedAtLedger: params.updatedAtLedger,
    feePerSubmission: params.feePerSubmission ?? 0n,
  };
}

export function formatOracleRpcError(asset: string, error: unknown): PriceOracleReadResult {
  const normalizedAsset = normalizeOracleAssetSymbol(asset);
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? ` (${error.message.trim()})`
      : "";
  return {
    status: "rpc-error",
    asset: normalizedAsset,
    message: `Could not read oracle feed "${normalizedAsset}" from Soroban RPC${detail}. Verify the oracle contract ID and Testnet RPC connectivity, then retry.`,
  };
}

type DynamicMethod = (args?: Record<string, unknown>) => Promise<{
  result: unknown;
}>;

function callMethod(client: contract.Client, name: string): DynamicMethod {
  return (client as unknown as Record<string, DynamicMethod>)[name];
}

export const priceOracleAdapter: PriceOracleAdapter = {
  async readFeed(oracleContractId: string, assetSymbol: string) {
    const asset = normalizeOracleAssetSymbol(assetSymbol);
    if (!isValidOracleContractId(oracleContractId)) {
      return {
        status: "rpc-error",
        asset,
        message:
          "Invalid price-oracle contract ID. Provide a 56-character Soroban contract address starting with C.",
      };
    }

    try {
      const rpc = requireRpcConfig();
      const client = await contract.Client.from({
        contractId: oracleContractId,
        rpcUrl: rpc.rpcUrl,
        networkPassphrase: rpc.networkPassphrase,
      });

      const [priceRes, tsRes, feeRes] = await Promise.all([
        callMethod(client, "price")({ asset }),
        callMethod(client, "price_timestamp")({ asset }),
        callMethod(client, "fee_per_submission")().catch(() => ({ result: 0n })),
      ]);

      const rawPrice =
        typeof priceRes.result === "bigint"
          ? priceRes.result
          : BigInt(String(priceRes.result ?? 0));
      const updatedAtLedger = Number(tsRes.result ?? 0);
      const feePerSubmission =
        typeof feeRes.result === "bigint"
          ? feeRes.result
          : BigInt(String(feeRes.result ?? 0));

      return interpretOracleFeedSnapshot({
        asset,
        rawPrice,
        updatedAtLedger,
        feePerSubmission,
      });
    } catch (error) {
      return formatOracleRpcError(asset, error);
    }
  },
};
