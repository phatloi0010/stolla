import { describe, expect, it } from "vitest";
import {
  ADR_266_DECISION_URL,
  ADR_266_DOC_PATH,
  EXPERIMENTAL_ORACLE_LABEL,
  formatOracleRpcError,
  interpretOracleFeedSnapshot,
  isValidOracleContractId,
  normalizeOracleAssetSymbol,
  resolveConfiguredOracleContractId,
} from "./priceOracle";

describe("price-oracle read-only consumer spike (#394)", () => {
  const validOracleId =
    "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH";

  it("hides the debug panel when no valid oracle contract ID is configured", () => {
    delete process.env.NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID;
    expect(resolveConfiguredOracleContractId(undefined)).toBeNull();
    expect(resolveConfiguredOracleContractId("")).toBeNull();
    expect(resolveConfiguredOracleContractId("not-a-contract-id")).toBeNull();
    expect(isValidOracleContractId("GABCD")).toBe(false);

    expect(resolveConfiguredOracleContractId(validOracleId)).toBe(validOracleId);
  });

  it("returns ok quote for active feed and actionable unset-feed message when price or timestamp is 0", () => {
    const okResult = interpretOracleFeedSnapshot({
      asset: "xlm_usdc",
      rawPrice: 1_245_000n,
      updatedAtLedger: 1500420,
      feePerSubmission: 100n,
    });
    expect(okResult).toEqual({
      status: "ok",
      asset: "XLM_USDC",
      rawPrice: 1_245_000n,
      updatedAtLedger: 1500420,
      feePerSubmission: 100n,
    });

    const unsetPrice = interpretOracleFeedSnapshot({
      asset: "BTC_USDC",
      rawPrice: 0n,
      updatedAtLedger: 0,
    });
    expect(unsetPrice.status).toBe("unset-feed");
    if (unsetPrice.status === "unset-feed") {
      expect(unsetPrice.message).toContain('Feed "BTC_USDC" has no published price');
      expect(unsetPrice.message).toContain("authorized relayer");
    }
  });

  it("formats actionable RPC errors and preserves #266 decision metadata & non-custody label", () => {
    const rpcErr = formatOracleRpcError(
      "xlm_usdc",
      new Error("503 Service Unavailable"),
    );
    expect(rpcErr.status).toBe("rpc-error");
    if (rpcErr.status === "rpc-error") {
      expect(rpcErr.asset).toBe("XLM_USDC");
      expect(rpcErr.message).toContain("503 Service Unavailable");
      expect(rpcErr.message).toContain("Verify the oracle contract ID and Testnet RPC connectivity");
    }

    expect(EXPERIMENTAL_ORACLE_LABEL).toContain("Experimental / not for custody");
    expect(ADR_266_DECISION_URL).toContain("/issues/266");
    expect(ADR_266_DOC_PATH).toContain("007-price-oracle-scope-and-consumer-spike.md");
    expect(normalizeOracleAssetSymbol("  xlm-usdc ")).toBe("XLMUSDC");
  });
});
