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
 * Guardrails baked in:
 *   - CHUNKED_IMAGE_PAGE_FILTER = the 5 pages → image-only, and PARKS before audio/package/full-book.
 *   - VISUAL_CONTRACT_ENFORCEMENT = true → the gate + bounded reroll actually run (non-prod only).
 *   - LOW tier comes from the ORDER (set the order to LOW before running); this script does not upgrade it.
 *
 * Usage:  VCC_PROOF_ORDER_ID=<anat order id> npx tsx scripts/run-anat-five-page-vcc-proof.ts
 * COST:   this RENDERS (paid). Do NOT run until Codex signs off on the T16 render.
 */
import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env.local' });
loadEnv();

import './shims/register-server-only.cjs';

function requireOrderId(): string {
  const id = process.env.VCC_PROOF_ORDER_ID?.trim();
  if (!id) {
    throw new Error('Set VCC_PROOF_ORDER_ID=<order id> (a LOW ענת order with a compiled BookVisualContract).');
  }
  return id;
}
const ORDER_ID: string = requireOrderId();

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${url}: ${res.status}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function readJsonIfExists(p: string): unknown {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

async function main() {
  const root = path.join(process.cwd(), 'outputs', 'visual-contract-proof', ORDER_ID);
  const manifestDir = path.join(root, 'ref-manifests');
  const proofDir = path.join(root, 'proof');
  for (const d of [root, manifestDir, proofDir]) fs.mkdirSync(d, { recursive: true });

  // The gate must run, and the run must PARK before audio/package — set BEFORE importing the worker.
  process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
  process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';
  process.env.PAGE_REF_MANIFEST_DIR = manifestDir;
  process.env.VISUAL_CONTRACT_PROOF_DIR = proofDir;

  const { prisma } = await import('@/lib/prisma');
  const { getCachedVisualContract } = await import('@/lib/generation-pipeline/visual-contract-stage');
  const { selectCalibrationPages } = await import('@/lib/visual-contract-compiler/selectCalibrationPages');
  const { clearOrderPageImages } = await import('@/lib/generation-chunked/clear-page-images-for-regen');
  const { runGenerationWorkerInvocation } = await import('@/lib/generation-chunked/process-worker');

  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  const cache = (job?.pipelineCache ?? {}) as Record<string, unknown>;
  const contract = getCachedVisualContract(cache as never);
  if (!contract) {
    throw new Error(
      'No compiled BookVisualContract in this order\'s cache. Run the order through the contract stage ' +
        'with VISUAL_CONTRACT_ENFORCEMENT=true first (ensureBookVisualContract), then re-run this proof.'
    );
  }

  // 5 DISTINCT measurable face pages (no cover) — the live page set under test.
  const selection = selectCalibrationPages(contract);
  const PAGES = selection.pageNumbers;
  if (PAGES.length < 5) {
    console.warn(`[vcc-proof] only ${PAGES.length} face page(s) available: ${PAGES.join(',')}`);
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

  const report: Record<string, unknown> = { orderId: ORDER_ID, pages: PAGES, enforced: true, results: {} };
  const results = report.results as Record<string, unknown>;

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
      results[String(pn)] = {
        imageUrl: row.imageAsset.url,
        localPath: dest,
        provider: row.imageAsset.provider,
        refManifest: readJsonIfExists(path.join(manifestDir, `page-${pn}.json`)),
        gateProof: readJsonIfExists(path.join(proofDir, `page-${pn}.json`)),
      };
    }
    // Done when every page either rendered or was BLOCKED by the gate (proof written, no image).
    const settled = PAGES.every(
      (p) => results[String(p)] || readJsonIfExists(path.join(proofDir, `page-${p}.json`))
    );
    if (settled) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Fold in proofs for pages the gate BLOCKED (no image row, but a proof file exists).
  for (const p of PAGES) {
    if (results[String(p)]) continue;
    const gateProof = readJsonIfExists(path.join(proofDir, `page-${p}.json`));
    if (gateProof) results[String(p)] = { imageUrl: null, blocked: true, gateProof };
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
