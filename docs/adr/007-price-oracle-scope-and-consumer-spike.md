# ADR-007: Price-Oracle Scope Decision (#266) and Read-Only Consumer Spike (#394)

## Status

Accepted (Spike / Experimental Read-Only Scope).

## Context

The repository includes `contracts/contracts/price-oracle`, a Soroban contract that records relayer-submitted asset pair prices (`price(asset)`, `price_timestamp(asset)`) and settles relayer submission fees in a configured SEP-0041 token (`fee_per_submission()`).

Issue #266 asked whether `price-oracle` should be integrated into core governance or treasury execution paths, kept as an optional observability primitive, or archived. Issue #394 requires recording that scope decision and shipping a minimal read-only web consumer behind a capability flag so the contract's role is concrete and testable.

## Decision (#266)

1. **Read-Only Debug & Observability Only (v1):**
   - `price-oracle` is retained strictly as an **experimental, non-custodial, read-only** feed reader for Testnet experimentation and community debug panels.
   - Neither `CommunityGovernor` nor `CommunityTreasury` may depend on `price-oracle` values for quorum, voting weight, proposal execution, or spend-cap conversion in v1 (see ADR-006: all treasury caps remain denominated in each asset's native smallest unit).
2. **Capability-Gated UI Surface (#394):**
   - The web application exposes `PriceOracleDebugPanel` on the community detail/debug view **only** when a valid Soroban contract ID (`C…`, 56 characters) is configured via `NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID` (or passed explicitly to the panel).
   - When unconfigured, the panel renders nothing so standard governance communities see zero oracle UI clutter.
   - When enabled, the panel must prominently display the label **"Experimental / not for custody"** and surface actionable guidance for both unset feeds (`price == 0` / `price_timestamp == 0`) and Soroban RPC failures.

## Consequences

- Communities and developers can inspect live or mocked `price-oracle` feeds (`XLM_USDC`, etc.) directly from the UI when `NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID` is set.
- Custodial and governance safety boundaries remain strictly isolated from oracle liveness or manipulation risks.
