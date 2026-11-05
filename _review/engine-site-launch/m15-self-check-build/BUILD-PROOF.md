STATUS: M15 PRODUCTION-LIKE BUILD PROOF BLOCKED
HEAD: 36bd62daf98cc73c1b3e49a2f3c3b23548d4bddd
Summary 1/5: Real Next 15.5.18 CLI builds were attempted on Windows/Node22.19.0; WSL access is denied and Docker daemon is unavailable.
Summary 2/5: Env-file loading and provider/service destinations were denied; only explicit non-secret placeholders and ignored .next output were available.
Summary 3/5: All three attempts exit1 on Google Font fetch errors; the final attempt binds the final M15 runtime/test bytes and verifies no drift.
Summary 4/5: The failed final compilation leaves122 partial NFT files; all17 inspected route traces exist but are unfinalized closure observations.
Summary 5/5: No complete function assets/sizes, Linux build/native-media execution, Vercel adapter package or deployment was proved.
Guy decisions: No new spend/product choice is requested. Engineering needs an authorized build environment with static-font access/cache and its own Linux dependency install; infrastructure actions remain separate.

## Command, isolation and actual failure

The command was `node node_modules/next/dist/bin/next build`, directly. The npm build script also runs Prisma generation, which would write into the shared node_modules junction; that step was not run. The existing generated client was used. `next.config.js` is unchanged. The local preload changes only distDir to an isolated ignored `.next/m15-build-proof/output-*` directory, retaining runtime settings/includes/excludes. It replaces Next's env-file loader, denies .env reads, restricts writes to this ignored proof tree and propagates to child processes.

The build process receives a clean environment: only selected OS variables and the explicit non-secret placeholders/disabled flags in BUILD-ATTEMPTS.json. No inherited provider/service credential was passed. The actual final preload is preserved as BUILD-GUARD.cjs and hash-bound to the final attempt. Source is M14 HEAD plus M15's pinned working files, not an invented M15 commit.

Attempt1 denied all network and failed with BUILD_GUARD_NETWORK_DENIED. Attempts2/final permitted only credential-free static Google Font GETs to fonts.googleapis.com/fonts.gstatic.com; the sandbox returned AggregateError EACCES. Provider/service destinations remained denied. No font substitution/mocking, layout edit, key, package installation, Prisma generation, daemon start or deployment was used to manufacture success.

All attempts end with:

```text
app/dev/personal-product/page.tsx
Failed to fetch `Fredoka` from Google Fonts.
Failed to fetch `Playpen Sans Hebrew` from Google Fonts.

app/layout.tsx
Failed to fetch `Arimo` from Google Fonts.
Failed to fetch `David Libre` from Google Fonts.
Failed to fetch `Frank Ruhl Libre` from Google Fonts.

> Build failed because of webpack errors
NATIVE_EXIT_CODE=1
```

`wsl.exe --list --quiet` fails with `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`. Docker version using an empty ignored local config cannot open `//./pipe/docker_engine` (pipe missing). Neither was installed or started; see linux-availability.log. The first Docker discovery also reported denied access to its existing config; no config contents were read or printed.

Exact placeholder names/values, command, times, source/guard/log hashes are in BUILD-ATTEMPTS.json. Raw logs/manifests/guards and output remain under ignored `.next/m15-build-proof/`. First two builds are development candidates; final is the stable runtime-source attempt after narrowing the terminal guard. There is no env-file workaround.

## Generated trace observations

These are partial files from the failed compiler. Next15.5.18 build/index.js invokes collect-build-traces after the server compiler resolves; collect-build-traces.js:412+ applies outputFileTracingIncludes/outputFileTracingExcludes. The failed output still contains excluded site/Style02 assets, omits explicit includes and references unproduced client manifests. This is not proof that final configuration strips required files; it is also not a successful bundle.

| Route | Partial MB | Raw fonts / both styles / sheets | Raw ffmpeg / ffprobe | Final size proof |
| --- | ---: | --- | --- | --- |
| `/api/engine-site/v1/books/[orderId]/assets/[assetId]` | 427.99 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/books/[orderId]` | 427.99 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/cron/reconcile` | 428.05 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/orders/[orderId]` | 427.99 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/orders` | 145.72 | no/no/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/photos/[assetId]` | 145.72 | no/no/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/photos` | 145.72 | no/no/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/review/[orderId]` | 428.0 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/engine-site/v1/review-policy` | 428.0 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/generate/cron/exceptions` | 428.46 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/generate/cron/human-qa-reconcile` | 0.19 | no/no/no | no/no | NOT PROVEN |
| `/api/generate/cron/operator-notifications` | 0.24 | no/no/no | no/no | NOT PROVEN |
| `/api/generate/cron/outbox` | 428.11 | yes/yes/yes | no/no | NOT PROVEN |
| `/api/generate/cron/sweep` | 384.84 | no/no/yes | no/no | NOT PROVEN |
| `/api/generate/worker` | 429.4 | no/yes/yes | no/no | NOT PROVEN |
| `/personal/book/[orderId]` | 428.42 | yes/yes/yes | no/no | NOT PROVEN |
| `/personal/review/[orderId]` | 428.37 | yes/yes/yes | no/no | NOT PROVEN |

The two unrelated legacy human-qa/operator-notification crons are included for visibility; they are not part of the personal test schedule. Intake/photo endpoints do not themselves render. Category observations are reported for every route without pretending each needs every binary. All actual render/decode consumers still require their selected authorities/assets and correct platform-native binaries.

Partial bytes preserve distinct logical paths even through the junction; missing files are retained rather than counted as zero-byte successes. NFT-INSPECTION.json records each exact trace hash, missing path and asset category. The standard Vercel Node bundle cap is250MB uncompressed including runtime layers. Incomplete trace closures cannot establish that compliance; no large-function beta was activated. See [Vercel limits](https://vercel.com/docs/functions/limitations) and [Next output tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

## Reproduction and remaining engineering proof

`python _review/engine-site-launch/m15-self-check-build/inspect_nft.py` reads existing final output only. Expected here: exit2 / NOT_PROVEN. It never manufactures traces or opens env-file contents. A later real build can supply its build-dir/build-manifest explicitly. Category presence alone is not exact selected-asset qualification; trace bytes omit some adapter/runtime layers. A Windows trace cannot prove Linux binary execution.

On an authorized clean Linux target, use the actual owner-committed/reviewed SHA and an independent lockfile dependency install. Resolve static font access or an approved exact cache, run full Next build to exit0, then inspect final traces, actual Vercel packaging/size and native media/font/Sharp/Pango execution. Fix reproducible complete-build findings generally. Do not strip needed media, alter book fonts/layout or relax gates to make a size assertion pass. Protected browser/runtime and the complete positive recipe/readmission composition remain separate requirements before paid activation.
