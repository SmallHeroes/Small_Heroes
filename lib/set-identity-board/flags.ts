/**
 * Set Identity Board — the ONE env gate for the live board path. Read at CALL TIME, never at module load.
 *
 * Mirrors the WS0b flag pattern verbatim (`isVisualContractFreezeEnabled`, contractRenderGuards.ts): HARD-FALSE on
 * the real Vercel Production runtime regardless of the env var, then an explicit opt-in everywhere else
 * (preview / staging / local / tests). Prod is cut over deliberately later — never by this var leaking onto it.
 *
 * OFF is INERT: with this false, `ensureSetIdentityBoardSnapshot` writes nothing, `deriveStartingStage` never
 * returns `'set_refs'`, no order ever acquires a `setIdentityBoards` snapshot, and therefore every downstream
 * board branch (bind stage, pre-render assertion, tagged refs) short-circuits on the ABSENT snapshot. The pipeline
 * is byte/behaviour-identical to today.
 *
 * NOTE on the snapshot-vs-flag split: once an order HAS a snapshot it is board-bound for life — the bind stage,
 * the pre-render assertion, and the tagged refs are gated on the SNAPSHOT, not on this flag, so flipping the var
 * off mid-book can never silently drop an already-bound board (it fails closed instead). This flag decides only
 * whether a NEW order is activated.
 */
import { isVercelProductionRuntime } from '@/lib/runtime-env';

/** Whether a NEW order may be activated onto the Set Identity Board path. Hard-off on Vercel Production. */
export function isSetIdentityBoardEnabled(): boolean {
  if (isVercelProductionRuntime()) return false;
  return process.env.SET_IDENTITY_BOARD === 'true';
}
