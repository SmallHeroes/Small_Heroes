/**
 * T16 PROOF DRIVER (live path) — render 5 measurable FACE pages of one order through the REAL pipeline
 * with the Visual Contract gate ENFORCED, and capture every artifact for eyeballing.
 *
 *   chunk-runner → generateAllPageImages → generateWithGPTImageStyle01Phase2(Once)  ← the live assembly
 *
 * It is NOT a harness: it drives runGenerationWorkerInvocation (the same worker prod runs), so the page
 * refs / prompt / gate are identical to a real order. The page set comes from selectCalibrationPages
 * (5 DISTINCT face pages, no cover) — the spreads most likely to expose a contract/render mismatch.
 *
 * Captures, per page, into outputs/visual-contract-proof/<orderId>/:
 *   - page-<n>.png                      the rendered image (download)
 *   - ref-manifests/page-<n>.json       the EXACT refs the live assembly used (PAGE_REF_MANIFEST_DIR)
 *   - proof/page-<n>.json               prompt block + per-attempt verdicts + PASS/BLOCK (VISUAL_CONTRACT_PROOF_DIR)
 *   - proof-report.json                 the rolled-up index of all of the above
 *
 * Guardrails baked in (FAIL-CLOSED):
 *   - CHUNKED_IMAGE_PAGE_FILTER = the 5 pages → image-only, and PARKS before audio/package/full-book.
 *   - VISUAL_CONTRACT_ENFORCEMENT = true → the gate + bounded reroll actually run (non-prod only).
 *   - LOW enforced IN CODE: GPT_IMAGE_QUALITY=low + STYLE_01_AUDITION_MODE=false (refuses a preset HIGH).
 *   - Clears images ONLY for a non-prod panda_anat (MVP QA) order with VCC_PROOF_ALLOW_CLEAR=1.
 *   - Refuses fewer than 5 distinct face pages; a page is "complete" only with BOTH gate-proof + manifest.
 *   - Wipes the proof dir each run and rejects any artifact older than run start (no stale pollution).
 *
 * The contract is compiled on demand from the SAME story-bank source the live pipeline uses: if the order
 * has no cached BookVisualContract this script loads story.pages via loadStoryFromBank + compiles/persists
 * via ensureBookVisualContract — so the proof's contract is IDENTICAL to live and T16 is ONE reproducible
 * command (no separate "compile first" step). If the cache lacks the story path it refuses (can't reproduce).
 *
 * Usage:  VCC_PROOF_ORDER_ID=<anat order id> VCC_PROOF_ALLOW_CLEAR=1 npx tsx scripts/run-anat-five-page-vcc-proof.ts
 * COST:   this RENDERS (paid, LOW) + one contract-compile LLM call if none is cached. Do NOT run until
 *         Codex signs off on the T16 render.
 */
import type { Prisma } from '@prisma/client';
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

function requireOrderId(): string {
  const id = process.env.VCC_PROOF_ORDER_ID?.trim();
  if (!id) {
    throw new Error('Set VCC_PROOF_ORDER_ID=<order id> (a non-prod panda_anat QA order; contract compiled on demand).');
  }
  return id;
}
const ORDER_ID: string = requireOrderId();

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** Read JSON only if the file exists AND is from THIS run (mtime >= runStart) — stale files are rejected. */
function readFreshJson(p: string, minMtimeMs: number): unknown {
  if (!fs.existsSync(p)) return null;
  if (fs.statSync(p).mtimeMs < minMtimeMs) {
    console.warn(`[vcc-proof] ignoring STALE ${path.basename(p)} (older than run start)`);
    return null;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  const runStart = Date.now();
  const root = path.join(process.cwd(), 'outputs', 'visual-contract-proof', ORDER_ID);
  const manifestDir = path.join(root, 'ref-manifests');
  const proofDir = path.join(root, 'proof');
  // CLEAN/ISOLATE: wipe any prior run's artifacts so nothing stale can survive, then recreate fresh.
  fs.rmSync(root, { recursive: true, force: true });
  for (const d of [root, manifestDir, proofDir]) fs.mkdirSync(d, { recursive: true });

  // Set BEFORE importing the worker: gate ON, park before audio/package, manifest + proof sinks.
  process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;
  process.env.VISUAL_CONTRACT_PROOF_DIR = proofDir;
  // ENFORCE LOW (cost-safe): refuse an explicit HIGH, then pin the normal book path to 'low' (audition OFF
  // → resolveGPTBookQuality reads GPT_IMAGE_QUALITY). Production HIGH must never leak into the proof.
  if ((process.env.GPT_IMAGE_QUALITY ?? '').trim().toLowerCase() === 'high') {
    throw new Error('GPT_IMAGE_QUALITY=high is set — the T16 proof is LOW-only. Unset it and re-run.');
  }
  process.env.GPT_IMAGE_QUALITY = 'low';
  process.env.STYLE_01_AUDITION_MODE = 'false';

  const { prisma } = await import('@/lib/prisma');
  const { ensureBookVisualContract, getCachedVisualContract } = await import(
    '@/lib/generation-pipeline/visual-contract-stage'
  );
  const { isVisualContractEnforcementEnabled } = await import('@/lib/visual-contract-compiler');
  const { resolveCompanionForOrder } = await import('@/lib/generation-pipeline/anchor-registry');
  const { loadStoryFromBank } = await import('@/backend/providers/story-bank-loader');
  const { resolveCachedStoryFilePath } = await import('@/lib/generation-pipeline/story-path');
  const { selectCalibrationPages } = await import('@/lib/visual-contract-compiler/selectCalibrationPages');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

  // FAIL-CLOSED isolation — the proof CLEARS page images (destructive). Refuse unless this is clearly a
  // non-prod, panda_anat (MVP QA companion) order AND the operator explicitly confirmed the clear.
  const order = await prisma.order.findUnique({ where: { id: ORDER_ID } });
  if (!order) throw new Error(`order ${ORDER_ID} not found`);
  const resolvedCompanion = resolveCompanionForOrder(order);
  const companionId = resolvedCompanion?.id ?? null;
  if (!isVisualContractEnforcementEnabled()) {
    throw new Error('VISUAL_CONTRACT_ENFORCEMENT/non-prod gate is OFF — refusing (prod-safety): the proof clears images.');
  }
  if (companionId !== 'panda_anat') {
    throw new Error(`order companion is "${companionId ?? 'none'}", not the panda_anat MVP QA companion — refusing to clear images.`);
  }
  if (process.env.VCC_PROOF_ALLOW_CLEAR !== '1') {
    throw new Error('destructive image-clear guard: set VCC_PROOF_ALLOW_CLEAR=1 to confirm this QA-isolated panda_anat order.');
  }

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  const cache = (job?.pipelineCache ?? {}) as Record<string, unknown>;
  let contract = getCachedVisualContract(cache as never);

  // SELF-COMPILE if the order has no cached contract → T16 is one reproducible command. FIDELITY: compile
  // from the IDENTICAL source the live chunk-runner feeds ensureBookVisualContract — loadStoryFromBank
  // (story bank, same args, skipLlmPersonalization) → story.pages + storyKey — so the proof's contract is
  // byte-for-byte the live contract, NOT a re-derivation from persisted page text. If the cache has no
  // story path we CANNOT reproduce the live source → refuse (run the order through the live contract stage).
  if (!contract) {
    const storyFilePath = resolveCachedStoryFilePath(cache as never);
    if (!storyFilePath) {
      throw new Error(
        'no cached story file path on this order — cannot faithfully reproduce the live contract source. ' +
          'Run the order through the live contract stage first (so pipelineCache has the story path), then re-run.'
      );
    }
    const story = await loadStoryFromBank(
      storyFilePath,
      order.childName || '',
      resolvedCompanion?.name ?? 'צפרדע',
      order.childGender || undefined,
      { skipLlmPersonalization: true }
    );
    console.log(
      `[vcc-proof] no cached contract — compiling from story bank ${path.basename(storyFilePath)} ` +
        `(${story.pages.length} pages, child=${order.childName ?? '?'}, companion=${companionId})`
    );
    const vcc = await ensureBookVisualContract({
      cache: cache as never,
      storyKey: path.basename(storyFilePath, '.md'),
      pages: story.pages,
      childName: order.childName,
      childGender: order.childGender,
      companion: resolvedCompanion ? { id: resolvedCompanion.id, name: resolvedCompanion.name } : null,
    });
    if (vcc.compiled) {
      await prisma.generationJob.update({
        where: { orderId: ORDER_ID },
        data: { pipelineCache: vcc.cache as unknown as Prisma.InputJsonValue },
      });
      console.log('[vcc-proof] compiled + persisted a fresh BookVisualContract');
    }
    contract = vcc.contract;
  }
  if (!contract) {
    throw new Error(
      'Contract is still null after compile — VISUAL_CONTRACT_ENFORCEMENT must be on AND non-prod ' +
        '(isVisualContractEnforcementEnabled). Check the runtime / env.'
    );
  }

  // 5 DISTINCT measurable face pages (no cover). FAIL-CLOSED when fewer than 5 — the proof is invalid.
  const selection = selectCalibrationPages(contract);
  const PAGES = selection.pageNumbers;
  if (PAGES.length < 5) {
    throw new Error(
      `selectCalibrationPages yielded only ${PAGES.length} face page(s) (${PAGES.join(',') || 'none'}) — ` +
        'the proof needs 5 distinct measurable face pages; refusing.'
    );
  }
  process.env.CHUNKED_IMAGE_PAGE_FILTER = PAGES.join(',');
  console.log(
    `[vcc-proof] order=${ORDER_ID} pages=${PAGES.join(',')} ` +
      `(establishing=${selection.establishingLocation}, zone=${selection.zoneTransitionSamePlace}, ` +
      `companion=${selection.companionAction}, prop=${selection.keyProp})`
  );

  const cleared = await clearOrderPageImages(prisma, ORDER_ID, PAGES);
  console.log(`[vcc-proof] cleared ${cleared} image asset(s) for the proof pages`);

  await prisma.generationJob.update({
    where: { orderId: ORDER_ID },
    data: { status: 'pending', currentStage: 'page_images', lastError: null, retryable: true, imagesDone: false },
  });

  const report: Record<string, unknown> = {
    orderId: ORDER_ID,
    companion: companionId,
    quality: 'low',
    enforced: true,
    pages: PAGES,
    results: {},
  };
  const results = report.results as Record<string, unknown>;
  const collect = (pn: number, base: Record<string, unknown>) => {
    const refManifest = readFreshJson(path.join(manifestDir, `page-${pn}.json`), runStart);
    const gateProof = readFreshJson(path.join(proofDir, `page-${pn}.json`), runStart);
    results[String(pn)] = {
      ...base,
      refManifest,
      gateProof,
      // A page is a COMPLETE proof data point only with BOTH a fresh gate-proof AND a fresh manifest.
      artifactsComplete: Boolean(refManifest && gateProof),
    };
  };

  // Drive the SAME worker prod runs; the filter parks it before audio/package. Bounded poll loop.
  for (let invocation = 1; invocation <= 80; invocation += 1) {
    await runGenerationWorkerInvocation(ORDER_ID);
    const rows = await prisma.bookPage.findMany({
      where: { book: { orderId: ORDER_ID }, pageNumber: { in: PAGES } },
      orderBy: { pageNumber: 'asc' },
      select: { pageNumber: true, imageAsset: { select: { url: true, provider: true } } },
    });
    for (const row of rows) {
      const pn = row.pageNumber;
      if (!row.imageAsset?.url || (results[String(pn)] as { imageUrl?: string })?.imageUrl) continue;
      const dest = path.join(root, `page-${pn}.png`);
      await download(row.imageAsset.url, dest);
      collect(pn, { imageUrl: row.imageAsset.url, localPath: dest, provider: row.imageAsset.provider });
    }
    // Settled when each page either rendered (image) OR was blocked (a FRESH gate-proof exists).
    const settled = PAGES.every(
      (p) =>
        (results[String(p)] as { imageUrl?: string })?.imageUrl ||
        readFreshJson(path.join(proofDir, `page-${p}.json`), runStart)
    );
    if (settled) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Fold in pages the gate BLOCKED (a fresh proof exists, no promoted image).
  for (const p of PAGES) {
    if (results[String(p)]) continue;
    if (readFreshJson(path.join(proofDir, `page-${p}.json`), runStart)) collect(p, { imageUrl: null, blocked: true });
  }

  const incomplete = PAGES.filter(
    (p) => !(results[String(p)] as { artifactsComplete?: boolean } | undefined)?.artifactsComplete
  );
  report.summary = {
    total: PAGES.length,
    artifactsComplete: PAGES.length - incomplete.length,
    incompletePages: incomplete,
  };
  if (incomplete.length) {
    console.warn(
      `[vcc-proof] ${incomplete.length} page(s) INCOMPLETE — missing a fresh gate-proof or manifest: ${incomplete.join(',')}`
    );
  }

  fs.writeFileSync(path.join(root, 'proof-report.json'), JSON.stringify(report, null, 2));
  console.log(`[vcc-proof] wrote ${path.join(root, 'proof-report.json')}`);
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
