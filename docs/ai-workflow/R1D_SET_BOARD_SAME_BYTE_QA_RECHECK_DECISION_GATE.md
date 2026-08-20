# Decision Gate — Set Board Same-Byte QA Recheck

**Decision:** approved by Guy's standing instruction to proceed without
wasting image spend. Implementation remains `$0` until independent Claude
Code PASS; the only post-PASS external action authorized here is one
Vision-only recheck of the existing home Board bytes.

## 1. Observed behavior

The first approved LOW Chameleon Set Board mint completed one `gpt-image-2`
generation and one content-addressed, no-overwrite upload. The exact stored PNG
has SHA-256
`492c8933ba67dbf3a537909e5925228aebf03f9690cd20443a55b72f0071bfd7`.
The image is an empty bedroom with a bed, bedside surface and window. Vision QA
returned the sole flag `excluded-prop:prop_striped_sock`; direct inspection of
the exact bytes shows no sock. The most plausible false-positive source is the
striped/fringed bed blanket, which is permitted set furnishing rather than a
separate excluded prop.

The current CLI wrote the registry candidate as `qaStatus: failed`, correctly
left it unapproved, and cannot approve it. The second authorized Board was not
minted. No reroll or retry occurred.

## 2. Root cause

The Vision instruction enumerates excluded props and fixed-prop obligations,
but omits the allowed set geometry already present in the guarded
`SetDefinition`. It also does not state that an excluded-prop flag requires a
distinct, recognizable physical object rather than a color, stripe, texture,
material or built-in furnishing that merely resembles words in the prop name.

The operator CLI has no same-byte QA recheck mode. Its only mint path always
generates and uploads a new image before QA, so a false-positive QA verdict can
only be escaped by spending another image or by unsafe manual mutation.

## 3. Approved general correction

1. Add the existing guarded set geometry to the Vision instruction.
2. Require excluded-prop flags to identify a distinct recognizable physical
   object; explicitly reject inference from an allowed surface, furnishing,
   color, pattern, texture, material or shape alone.
3. Add one explicit `--recheck` CLI mode over an existing failed, unapproved,
   rendered registry entry.
4. Before Vision, recompute the current Set definition, identity fields,
   content-policy digest and prompt hash; download the exact `storageKey` bytes
   and verify `assetSha256`.
5. Persist a deterministic one-shot recheck record before calling Vision. A
   pre-existing record blocks any second recheck, including after failure or
   interruption.
6. The recheck may update only `qaStatus` and `qaCheckedAt`, and only from an
   affirmative well-formed Vision result. It cannot render, upload, approve,
   change image bytes or change identity authority.
7. Human approval remains a separate explicit command and is still necessary.

## 4. Scope and exclusions

This is a general Set Board QA/operator correction. It contains no Chameleon,
sock, bedroom, page or story literal in production code.

Out of scope:

- image rerender or regeneration;
- second Set Board mint before this gate passes;
- manual QA override or direct registry mutation;
- automatic Board approval;
- page rendering, Visual Package promotion or Wizard release;
- model, image quality, storage key, provider retry, resemblance threshold or
  fallback changes.

## 5. Expected behavior

- A clean permitted furnishing cannot be rejected solely because a pattern or
  texture resembles an excluded prop name.
- A real distinct excluded prop, person, animal, action, text, panel or invalid
  opening remains a failure.
- Malformed/absent Vision evidence remains fail-closed.
- A recheck uses the exact already-stored bytes or refuses before Vision.
- Identity, prompt, content policy, bytes, approval or prior-status drift
  refuses before Vision.
- One recheck record permanently consumes the recheck slot; there is no loop.
- A passing recheck remains unapproved until Guy explicitly approves it.

## 6. Validation plan

Provider-free tests must prove:

1. allowed geometry and the distinct-object rule are present in the actual QA
   instruction;
2. character/text/panel/opening and recognizable excluded-prop flags still
   fail;
3. parse/CLI flag combinations fail closed;
4. passing same-byte recheck performs zero render and zero upload, calls QA
   once, writes one completed record, updates only QA fields and leaves approval
   null;
5. failing/malformed recheck remains failed and cannot be repeated;
6. stale identity, prompt, policy, missing bytes, hash mismatch, pending/passed
   status, existing approval and pre-existing record all stop before QA;
7. the record is already present while the QA callback runs, closing a crash
   window against an unrecorded retry;
8. focused Set Board suites, `npx tsc --noEmit`, `git diff --check` and one
   literal repository gate run proportionately.

## 7. Cost and execution allowance

Implementation and tests cost `$0`. After independent Claude Code PASS and
push, exactly one Vision-only recheck of the already-stored home Board is
allowed. It includes zero image calls and zero storage writes. If it fails or
is interrupted, stop; no second recheck and no rerender are implied.

The town Board remains unminted until the home Board passes technical and human
visual review.

## 8. Rollback

Revert the focused code commit. The failed v4 registry candidate and exact
content-addressed PNG remain inert and unapproved. No production or customer
authority is changed.

## Stop-check

1. General fix: yes; shared QA/operator path only.
2. Cross-story risk: bounded by current Set identity/prompt/byte revalidation
   and hostile tests.
3. Production behavior: QA instruction and offline operator CLI only.
4. Spend: `$0` before independent PASS; then one Vision-only call.
5. Smallest proof: injected same-byte recheck tests, no image.
6. Guy decision: standing instruction to continue while avoiding wasted image
   spend; no weakening or manual override is assumed.
7. Claude falsification: identity/byte drift, repeatability, crash-window,
   QA weakening, render/upload reachability and hidden approval.
8. Creative consultation: not required; the stored image is unchanged.
9. Guy eyeball: the exact home PNG after an automated pass and before approval.
