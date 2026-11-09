"use client";

import { useCallback, useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import {
  ADR_266_DECISION_URL,
  ADR_266_DOC_PATH,
  EXPERIMENTAL_ORACLE_LABEL,
  normalizeOracleAssetSymbol,
  priceOracleAdapter,
  resolveConfiguredOracleContractId,
  type PriceOracleAdapter,
  type PriceOracleReadResult,
} from "@/lib/community/priceOracle";

export type PriceOracleDebugPanelProps = {
  oracleContractId?: string | null;
  defaultAsset?: string;
  adapter?: PriceOracleAdapter;
};

export function PriceOracleDebugPanel({
  oracleContractId,
  defaultAsset = "XLM_USDC",
  adapter = priceOracleAdapter,
}: PriceOracleDebugPanelProps) {
  const configuredContractId = resolveConfiguredOracleContractId(oracleContractId);
  const [assetInput, setAssetInput] = useState(defaultAsset);
  const [result, setResult] = useState<PriceOracleReadResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFeed = useCallback(
    async (symbolToRead: string) => {
      if (!configuredContractId) return;
      setLoading(true);
      try {
        const next = await adapter.readFeed(
          configuredContractId,
          normalizeOracleAssetSymbol(symbolToRead),
        );
        setResult(next);
      } finally {
        setLoading(false);
      }
    },
    [adapter, configuredContractId],
  );

  useEffect(() => {
    if (!configuredContractId) return;
    void loadFeed(defaultAsset);
  }, [configuredContractId, defaultAsset, loadFeed]);

  if (!configuredContractId) {
    return null;
  }

  return (
    <section
      aria-label="Price oracle debug panel"
      className="mt-6 rounded-xl border border-amber-700/60 bg-[#151b2b] p-5 text-sm text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-100">
          Price Oracle Consumer Spike
        </h2>
        <span className="rounded-full border border-amber-500/50 bg-amber-950/70 px-3 py-1 text-xs font-semibold text-amber-200">
          {EXPERIMENTAL_ORACLE_LABEL}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Read-only diagnostic view for{" "}
        <code className="font-mono text-slate-200">{configuredContractId}</code>.
        Oracle values are never used in Governor voting or Treasury execution. See{" "}
        <a
          href={ADR_266_DECISION_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-indigo-300 underline hover:text-indigo-200"
        >
          #266 decision notes ({ADR_266_DOC_PATH})
        </a>
        .
      </p>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void loadFeed(assetInput);
        }}
      >
        <label className="block text-xs text-slate-300">
          Feed symbol
          <input
            aria-label="Oracle feed symbol"
            value={assetInput}
            onChange={(event) => setAssetInput(event.target.value)}
            className="mt-1 block w-44 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100"
          />
        </label>
        <AppButton type="submit" tone="secondary" disabled={loading}>
          {loading ? "Reading feed…" : "Read feed"}
        </AppButton>
      </form>

      {result?.status === "ok" && (
        <dl className="mt-4 grid gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-400">Feed pair</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-slate-100">
              {result.asset}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Aggregated raw value</dt>
            <dd className="mt-1 font-mono text-sm font-semibold text-emerald-300">
              {result.rawPrice.toString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Last updated ledger</dt>
            <dd className="mt-1 font-mono text-sm text-slate-200">
              #{result.updatedAtLedger}
            </dd>
          </div>
        </dl>
      )}

      {result?.status === "unset-feed" && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-amber-700/70 bg-amber-950/50 p-3 text-xs text-amber-100"
        >
          <p className="font-semibold">Unset oracle feed ({result.asset})</p>
          <p className="mt-1">{result.message}</p>
        </div>
      )}

      {result?.status === "rpc-error" && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-700/70 bg-rose-950/50 p-3 text-xs text-rose-100"
        >
          <p className="font-semibold">Oracle RPC read failed ({result.asset})</p>
          <p className="mt-1">{result.message}</p>
          <AppButton
            tone="secondary"
            className="mt-2"
            onClick={() => void loadFeed(assetInput)}
          >
            Retry feed
          </AppButton>
        </div>
      )}
    </section>
  );
}
