# R3-B0b Provider-Free Import Closure Correction — Implementation Evidence

Date: 2026-09-02
Product owner: Guy
Technical owner: Codex
Branch: `codex/r3b0b-story-source-review-batch`
Worktree: `C:\GNart\Work\sh-r3b0b-story-source-review`
Pushed correction base: `8b0818fee5f4338839caa7e3117f97861ee4a867`
Review range: `8b0818fee5f4338839caa7e3117f97861ee4a867..R3-B0b provider-isolation corrective commit`

## Incoming independent QA result

Claude Code independently reviewed
`68795de8c519f1260e01737582165cbe0ec75433..8b0818fee5f4338839caa7e3117f97861ee4a867`
read-only and returned PASS with no P0/P1. It reproduced the exact batch,
selection, digest, deterministic replay, authority-chain and source-projection
claims, zero-effect execution, protected roots and human/runtime gates.

It left two P2 notes:

1. The CLI behaved provider-free under execution sentinels, but its static
   import closure reached provider-capable modules through
   `wizard-render-readiness` -> `companion-character-sheet` ->
   `generate-image` / runtime storage. The modules were inert, and the edge was
   inherited rather than introduced by R3-B0b, but a later module-scope side
   effect could have weakened the zero-cost boundary.
2. The repository-wide gate still exits 1 on the already-disclosed missing
   ignored historical output fixtures and Vitest `onTaskUpdate` RPC timeouts.
   This is baseline evidence, not a defect introduced by the reviewed range.

Guy pushed the reviewed initial commit. This follow-on milestone corrects P2-1
only; it does not relabel P2-2 or the repository-wide gate as green.

## Root cause and correction

Wizard readiness needed only the passive companion-sheet view type, ordered
view names and filename map, but imported them from the provider-capable sheet
generator. Static ESM loading therefore pulled image generation and runtime
artifact storage into the read-only CLI's module graph even though no provider,
credential, network or write behavior executed.

The smallest general correction is:

- add dependency-free
  `lib/generation-pipeline/companion-character-sheet-contract.ts` containing
  only `CompanionSheetViewKind`, `COMPANION_SHEET_VIEW_KINDS` and
  `COMPANION_SHEET_VIEW_FILENAME`;
- make the existing generator import and re-export those exact symbols, so
  existing callers keep the same public module contract;
- make `lib/wizard-render-readiness.ts` consume the passive leaf directly;
- add both an eager-load sentinel and a supported direct-literal static
  import-graph gate to the
  R3-B0b review-batch spec.

No generation algorithm, prompt, provider, model, style, Story Source, Visual
Direction, package, readiness predicate, runtime route, acceptance state or
resemblance threshold changed.

## Regression proof

The eager subprocess gate hooks `Module._load` before launching the real CLI
help path. It rejects known provider packages and provider/generation/storage
local modules. A positive control imports the heavy companion generator and
must trip the same sentinel; a second direct control proves
`backend/providers/image.ts` is itself denied rather than relying on an earlier
transitive tripwire. Provider roots and forbidden local stems are generated
from the same canonical test constants used by the static gate. Package IDs are
normalized for case and Windows separators; uppercase `OPENAI` and
`OPENAI\\index.js` controls prove both package-resolution variants are closed.
The sentinel also recognizes direct provider file paths beneath
`node_modules`; a relative `./node_modules/openai/index.js` control must trip it.
It classifies both the raw request and the loader-resolved canonical realpath;
a junction alias to the provider must therefore trip the same boundary.

The static gate parses the supported direct-literal runtime import graph with the
TypeScript AST, follows repository-relative and `@/` edges, fails closed on an
unresolved local edge, and checks both forbidden local modules and provider
packages. Both lexical and canonical-realpath resolutions that escape the
repository or enter `node_modules` fail closed rather than being traversed as
ordinary source; the graph follows the canonical target of an in-repo alias. It
also rejects literal URL schemes (`file:`, `data:` and peers) and absolute/UNC
module paths; the graph loop permits only the explicit `node:` built-in scheme.
It recognizes runtime import/export declarations, `import = require`, literal
dynamic `import()`, bare or parenthesized CommonJS
`require()`, `module.require()` and immediate `createRequire(...)()` while
excluding explicit type-only edges. A reachable nonliteral dynamic
`import(expr)` or nonliteral recognized direct loader fails closed rather than
silently leaving the graph. Positive controls prove:

- the heavy companion generator reaches `lib/generate-image.ts`, `openai` and
  `replicate`;
- `import OpenAI, { type ClientOptions } from 'openai'` remains a runtime edge;
- two-argument `import('replicate', { with: ... })` remains a runtime edge;
- multi-argument `require('@supabase/supabase-js', undefined)` in CJS remains a
  runtime edge;
- `(require)(...)`, `module.require(...)` and immediate
  `createRequire(import.meta.url)(...)` remain runtime edges;
- nonliteral dynamic `import(expr)` is rejected;
- direct relative provider-file resolution through `node_modules` is rejected
  by both gates;
- a junction alias cannot hide an external/provider realpath from either gate;
- a native-ESM `file:` URL targeting the installed OpenAI entry is rejected by
  the static gate, as are `data:` and absolute literal module paths.

Arbitrary data-flow aliases such as `const load = createRequire(...); load(x)`
are deliberately outside this bounded static walker rather than being claimed
as covered. The eager `Module._load` sentinel rejects executed CommonJS and the
concrete tsx-transpiled CLI load path; it is not claimed to intercept native
ESM generally. Native dynamic imports in the reachable graph must use a literal
specifier, and the current provider-free leaf contains no loader or import at
all. Static provider package comparison normalizes case and Windows separators;
repo-relative module paths are normalized for Windows before deny-list
comparison.

The final CLI graph includes the passive contract and includes none of the
denied provider-capable local modules or packages. Internal adversarial review
found no remaining actionable P0/P1/P2 after falsifying and correcting the
successive coverage gaps above. That internal result does not replace
the required independent Claude Code re-gate.

## Preserved exact batch and effects

Post-correction dry-run reproduces the same content address:

- batch digest:
  `7a8434c76f90bc96776909430e93fecb97f2c8a08800085d0ba3e55d7f97a143`;
- ignored artifact: 207,472 bytes, raw SHA-256
  `143ff1a7a0f67382ae5efce1deecf492761bb51809f7183cf6c8304c682d5a08`;
- 17 exact records from the live readiness predicate: 5 bedtime / 6 adventure
  / 6 fantasy, 208 pages, all six fantasy stories at 16 pages;
- artifact replay remains `created:false`;
- all declared effect counters remain zero.

Strict readiness remains 1/18. The Chameleon package and locator are unchanged.
The resemblance threshold remains 0.70. No provider/network/database/storage
call, image/audio/PDF render, order/payment/deployment mutation or spend was
authorized or performed.

## Validation

Final corrective-tree results:

1. `npx tsc --noEmit --pretty false` — exit 0.
2. `npm run story:autonomous-typecheck` — exit 0.
3. R3-B0b focused provider-closure spec — 1 file, 14/14 tests PASS; focused
   batch plus workload classifier — 2 files, 21/21 tests PASS.
4. Adjacent Wizard readiness/runtime/companion/classifier slice — 5 files,
   31/31 tests PASS.
5. Literal final `npm run check`:
   - canonical inventory 381 files: 361 ordinary / 20 resource-intensive;
   - ordinary: 337 files passed, 17 skipped, 7 failed; 4,777 tests passed,
     73 skipped, 11 failed;
   - 10 failures are the same ENOENT reads from six unchanged specs that
     require six absent ignored historical `outputs/` fixtures;
   - the eleventh is a 5,000 ms timeout in the unchanged all-story readiness
     determinism cell under the four-worker load; the file immediately reran
     alone at 11/11 PASS, with that cell completing in 4,881 ms and no assertion
     mismatch;
   - resource-intensive: 20/20 files and 640/640 tests PASS, followed by three
     known `onTaskUpdate` RPC timeout errors;
   - overall exit 1 and remains reported as failed.
6. `git diff --check` — required again immediately before commit.

No ignored fixture was copied and no test was disabled to manufacture a green
result.

## Scope, stop-check and rollback

This is a technical import-isolation correction under the already-approved
zero-cost R3-B0b boundary. It changes no major-action product surface and
requires no new image, prompt, story, package, acceptance, runtime, payment or
publication Decision Gate. Cost allowance is USD 0; actual cost is USD 0.

Rollback is the single corrective commit. Reverting it restores the inherited
inert import graph without changing the initial pushed batch artifact or its
authority.

## Independent re-gate targets

1. Confirm exact one-commit/no-merge topology from pushed base `8b0818fe` and a
   clean tree.
2. Confirm the new leaf is dependency-free and the existing heavy generator's
   exported values and type remain compatible.
3. Trace both eager and literal static CLI import closures and try to reinsert a
   denied provider/generation/storage edge.
4. Falsify the documented direct-literal AST classifier with type-only, mixed
   value/type, default, side-effect, re-export, dynamic-import, CommonJS and
   immediate-createRequire forms; confirm nonliteral dynamic imports fail
   closed, Windows casing/separator variants and direct provider file paths are
   denied, filesystem aliases cannot hide canonical targets, and arbitrary
   CommonJS alias data-flow is not overclaimed. Confirm `file:`/`data:` and
   absolute/UNC literals fail closed while `node:` built-ins remain allowed.
5. Reproduce the unchanged batch digest, bytes, 17-record shape and all-zero
   effects.
6. Confirm protected authorities, Chameleon bytes, readiness, human gates and
   the 0.70 resemblance threshold are unchanged.
7. Keep the known fixture/RPC repository failure visible; do not count it as
   PASS or as a new correction defect.
