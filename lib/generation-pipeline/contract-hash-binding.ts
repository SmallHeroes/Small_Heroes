/**
 * (WS0b P1-4) Bind the asset write-barrier's receipt KEY + PAYLOAD to the render-time contract hash.
 *
 * The asset write is content-addressed on its delivered URL (idempotent on the bytes). But the receipt fence
 * (INSERT ... ON CONFLICT DO NOTHING) NEVER re-runs the callback on a same-key hit — so a same-URL redrive under a
 * NEW frozen contract would replay the OLD receipt and leave the atomically-bound QualityContext.contractHash stale
 * (compounding the P1-3 contract_stale recovery). Binding the operationKey + payload to the contract hash makes a
 * NEW hash a NEW operation that RE-RUNS the (idempotent, same-URL → same-bytes) asset write + the fresh contract
 * binding — while a same-URL/same-hash redrive still replays. Absent/empty when no contract is frozen
 * (renderedContractHash null) → the operationKey + payload are byte-identical to pre-P1-4.
 *
 * Pure (no imports) so it is unit-testable without loading the chunk-runner. The real fence behavior (a new op
 * actually re-running the callback) is staging-confirmable.
 */

/** operationKey suffix — `:${hash}` when a contract is frozen, else '' (freeze-off byte-identical). */
export function contractHashKeySuffix(renderedContractHash: string | null): string {
  return renderedContractHash ? `:${renderedContractHash}` : '';
}

/** The cover asset write-barrier operationKey: content-addressed URL + the contract-hash binding. */
export function coverAssetOperationKey(
  orderId: string,
  coverUrl: string,
  renderedContractHash: string | null,
): string {
  return `delivery_input:${orderId}:cover:${coverUrl}${contractHashKeySuffix(renderedContractHash)}`;
}

/** The page asset write-barrier operationKey: page slot + content-addressed URL + the contract-hash binding. */
export function pageAssetOperationKey(
  orderId: string,
  pageNumber: number,
  deliveredUrl: string,
  renderedContractHash: string | null,
): string {
  return `delivery_input:${orderId}:page:${pageNumber}:${deliveredUrl}${contractHashKeySuffix(renderedContractHash)}`;
}

/**
 * The contractHash fragment for the asset mutationPayload — the payload must cover what the callback also writes
 * (persistQualityContext binds contractHash). Absent (empty spread) when no contract is frozen → payload
 * byte-identical to pre-P1-4.
 */
export function contractHashPayloadFragment(renderedContractHash: string | null): { contractHash?: string } {
  return renderedContractHash ? { contractHash: renderedContractHash } : {};
}
