/**
 * DRY-RUN PROMPT MANIFEST (bunny addendum step 6) — NO rendering, no LLM calls.
 *
 * Creates a FRESH dev order (Style 01 explicit, same child + photo as the failed
 * order, NO cache reuse) and reconstructs cover/p1/p6 prompts + reference lists
 * with the SAME assembly/resolver functions the pipeline uses, then verifies:
 *   1. COMPANION LOCK = registry bunny text (cream-white/floppy/heart badge),
 *      never the LLM DNA ("stuffed"/"gray") — replayed against the FAILED
 *      order's actual contaminated DNA as an adversarial input.
 *   2. No dna.companionDNA text anywhere in prompts.
 *   3. order.illustrationStyle = Style 01 AND pipeline branch matches (+ sellable).
 *   4. Style refs = the 4 approved character-free files ONLY (subsets + Stage-0).
 *   5. Child anchor bound on child-present pages incl. cover; scenarioSettingLock
 *      (clinic) present on all prompts.
 *
 * Usage:
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/dry-run-bunny-manifest.ts [existingFreshOrderId]
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv();

import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { parsePipelineCache } from '../lib/generation-pipeline/helpers';
import { resolveCompanionForOrder } from '../lib/generation-pipeline/anchor-registry';
import { getWizardMeta } from '../lib/orderMeta';
import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import { buildEnrichedScenePrompt, deriveLayout } from '../backend/providers/image-prompt-enricher';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';
import {
  STYLE_01_REF_SUBSETS,
  assembleStyle01BookReferences,
  resolveStyle01CompanionReferencePaths,
  resolveStyle01RefBudgetConfig,
  resolveStyle01StyleReferencePaths,
} from '../lib/style01-gptimage';
import { buildStage0MethodBReferences } from '../lib/generation-pipeline/stage0-method-b';
import { childPresenceAllowsReferencePhoto } from '../lib/image-entity-presence';
import {
  assertOrderStyleSellable,
  resolveOrderStyleBranch,
} from '../lib/image-engine-guard';

const FAILED_ORDER_ID = 'cmq82b5f300024wyolypqecob';
const BANK_FILE = path.join(process.cwd(), 'story-bank', 'v3-approved', 'bunny_ometz_bedtime.md');
const APPROVED_STYLE_REFS = [
  'style01-texture-night-window.png',
  'style01-texture-stream-rocks.png',
  'style01-texture-porch-lavender.png',
  'style01-texture-night-mountains.png',
];
const SIMULATED_CHILD_ANCHOR = 'SIMULATED_CHILD_ANCHOR_URL(stage0-generates-at-render)';
const MANIFEST_PAGES = [1, 6];

type Check = { id: string; label: string; pass: boolean; detail: string };
const checks: Check[] = [];
function check(id: string, label: string, pass: boolean, detail: string) {
  checks.push({ id, label, pass, detail });
}

function fence(s: string | null | undefined): string {
  return '```\n' + (s ?? '(empty)') + '\n```';
}

async function createFreshOrder(): Promise<string> {
  const src = await prisma.order.findUnique({ where: { id: FAILED_ORDER_ID } });
  if (!src) throw new Error(`source order ${FAILED_ORDER_ID} not found`);
  const fresh = await prisma.order.create({
    data: {
      status: 'paid',
      customerEmail: src.customerEmail,
      customerName: src.customerName,
      childName: src.childName,
      childAge: src.childAge,
      childGender: src.childGender,
      childTraits: src.childTraits,
      childSuperpower: src.childSuperpower,
      bookName: src.bookName,
      dedication: src.dedication,
      // Same child photo as the failed order (addendum D)
      childImageUrl: src.childImageUrl,
      characterAnchors: src.characterAnchors ?? undefined,
      familyContext: src.familyContext ?? undefined,
      topic: src.topic,
      challengeItems: src.challengeItems,
      challengeFree: src.challengeFree,
      outcomeItems: src.outcomeItems,
      outcomeFree: src.outcomeFree,
      helperItems: src.helperItems,
      helperFree: src.helperFree,
      avoidItems: src.avoidItems,
      avoidFree: src.avoidFree,
      storyLength: src.storyLength,
      storyDirection: src.storyDirection,
      // Style 01 EXPLICIT (DB enum value for soft_hand_drawn_storybook)
      illustrationStyle: 'pencil_watercolor',
      audioEnabled: false,
      pdfEnabled: false,
      bundleEnabled: false,
      videoEnabled: false,
      basePrice: src.basePrice,
      addonsPrice: 0,
      totalPrice: src.basePrice,
      paymentProvider: 'fake',
    },
  });
  return fresh.id;
}

async function main() {
  const existingId = process.argv[2]?.trim();
  const orderId = existingId || (await createFreshOrder());
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error(`fresh order ${orderId} not found`);

  // Adversarial input: the FAILED order's actual LLM companion DNA from its cache.
  const failedJob = await prisma.generationJob.findUnique({ where: { orderId: FAILED_ORDER_ID } });
  const failedCache = failedJob ? parsePipelineCache(failedJob.pipelineCache) : null;
  const contaminatedDNA = failedCache?.dna?.companionDNA ?? 'Stuffed rabbit toy with soft gray fur and white inner ears';
  const contaminatedStructured = failedCache?.dna?.companionStructured ?? {
    species: 'Stuffed rabbit toy',
    size: 'small, plush',
    coloring: 'Soft gray fur with white inner ears',
    feature: 'button eyes',
  };

  const companion = resolveCompanionForOrder(order);
  if (!companion) throw new Error('companion did not resolve');
  const wizardMeta = getWizardMeta(order.characterAnchors);
  const challengeCategory = wizardMeta.challengeCategory ?? 'MEDICAL_PROCEDURE';
  const refConfig = resolveStyle01RefBudgetConfig();

  // ── Check 3: style truth ──
  const branch = resolveOrderStyleBranch(order.illustrationStyle);
  check(
    'C3a',
    'order.illustrationStyle resolves to the Style 01 branch',
    branch === 'style01',
    `illustrationStyle=${order.illustrationStyle} → branch=${branch}`
  );
  let sellableOk = true;
  try {
    assertOrderStyleSellable(order.illustrationStyle, 'dry-run');
  } catch {
    sellableOk = false;
  }
  check('C3b', 'sellable gate passes for this order', sellableOk, `STYLE02_SELLABLE=${process.env.STYLE02_SELLABLE ?? '(unset)'}`);

  // ── Check 4: style refs everywhere ──
  const subsetFiles = Object.values(STYLE_01_REF_SUBSETS).flatMap((s) => s.filenames);
  const badSubset = subsetFiles.filter((f) => !APPROVED_STYLE_REFS.includes(f));
  check(
    'C4a',
    'STYLE_01_REF_SUBSETS uses ONLY the 4 approved character-free refs',
    badSubset.length === 0,
    badSubset.length ? `non-approved: ${badSubset.join(', ')}` : `files: ${[...new Set(subsetFiles)].join(', ')}`
  );
  const stage0 = buildStage0MethodBReferences({ childPhotoUrl: '(photo)', childGender: order.childGender });
  const stage0Bad = stage0.paths.filter((p) => p.includes('ChatGPT Image'));
  check(
    'C4b',
    'Stage-0 reference list has zero old character refs',
    stage0Bad.length === 0,
    `stage0 paths: ${stage0.paths.map((p) => path.basename(p)).join(' | ')}`
  );

  // ── Story (bank, deterministic) ──
  const story = await loadStoryFromBank(
    BANK_FILE,
    order.childName || '',
    companion.name,
    order.childGender || undefined,
    { skipLlmPersonalization: true }
  );

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);
  push(`# DRY-RUN Prompt Manifest — fresh order \`${orderId}\` (bunny, Style 01)`);
  push();
  push(`Generated: ${new Date().toISOString()} · NO images generated, NO LLM calls. Deterministic re-run of the pipeline's own assembly/resolver functions.`);
  push();
  push(`- source of child data/photo: failed order \`${FAILED_ORDER_ID}\` (cache NOT reused)`);
  push(`- bank file: \`${path.relative(process.cwd(), BANK_FILE)}\` · pages: ${story.pages.length} · storyTimeOfDay: \`${story.storyTimeOfDay}\``);
  push(`- companion: \`${companion.id}\` · sheets published: ${fs.existsSync(path.join(process.cwd(), 'public', 'companions', companion.id, 'style01-sheets', 'front.png'))}`);
  push(`- order.illustrationStyle: \`${order.illustrationStyle}\` → branch \`${branch}\` · challengeCategory: \`${challengeCategory}\` · refConfig: \`${refConfig}\``);
  push(`- child anchor: SIMULATED placeholder (Stage-0 generates at render; binding logic exercised for real)`);
  push(`- adversarial DNA replayed from failed cache: \`${contaminatedDNA.slice(0, 90)}…\``);
  push();

  const childStructured = {
    face: 'Oval face shape, light olive skin tone. Almond-shaped brown eyes. Prominent cheeks.',
    hair: 'Long, light brown curly hair that falls past the shoulders.',
    body: 'Build and height appropriate for a 7-year-old girl.',
    clothing: 'sky-blue t-shirt with yellow sun, denim shorts, red sneakers',
    signature: 'prominent cheek',
  };

  const assembleFor = (input: {
    pageNumber: number;
    rawScenePrompt?: string | null;
    imagePrompt: string;
    bookPageText?: string;
    imageSubject?: string | null;
    isLetter?: boolean;
    label: string;
    assetType?: 'page' | 'cover';
  }) => {
    const layout = deriveLayout({
      pageNumber: input.pageNumber,
      totalPages: story.pages.length,
      text: input.bookPageText ?? '',
      isLetter: Boolean(input.isLetter),
    });
    const enriched = buildEnrichedScenePrompt({
      rawScenePrompt: input.rawScenePrompt ?? undefined,
      imagePrompt: input.imagePrompt,
      layout,
      text: input.bookPageText ?? '',
      textZone: null,
      isLetter: input.isLetter,
      pageNumber: input.pageNumber,
      totalPages: story.pages.length,
    });
    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: input.pageNumber,
      totalPages: story.pages.length,
      pagePrompt: enriched.imagePrompt,
      rawScenePrompt: enriched.rawScenePrompt,
      bookPageText: input.bookPageText,
      childFirstName: order.childName,
      childAge: order.childAge,
      childGender: order.childGender,
      childDescription: '(child DNA generated at render — placeholder)',
      childStructured,
      assetType: input.assetType,
      storyTitle: input.assetType === 'cover' ? story.title : undefined,
      coverText: input.assetType === 'cover' ? story.coverText : undefined,
      topicLabel: input.assetType === 'cover' ? (order.topic ?? 'MEDICAL_PROCEDURE') : undefined,
      coverSceneHint: input.assetType === 'cover' ? story.coverSceneHint : undefined,
      companion: {
        id: companion.id,
        name: companion.name,
        // adversarial: feed the FAILED order's DNA — registry must win
        visualDescription: contaminatedDNA,
        image: companion.image,
      },
      companionStructured: contaminatedStructured,
      challengeCategory,
      storyRecurringEntityDeclarations: story.storyRecurringEntities,
      storyTimeOfDay: story.storyTimeOfDay,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
    });

    const companionRefPaths =
      assembled.entityPresence.companionPresence === 'absent'
        ? []
        : resolveStyle01CompanionReferencePaths({
            companionId: companion.id,
            companionImage: companion.image,
            companionPresence: assembled.entityPresence.companionPresence,
            pageNumber: input.pageNumber,
            imagePrompt: enriched.imagePrompt,
            bookPageText: input.bookPageText,
            rawScenePrompt: enriched.rawScenePrompt,
          });
    const useMultiCompanionSheets = companionRefPaths.length >= 3;
    const styleRefCount = useMultiCompanionSheets ? 1 : refConfig === 'A' ? 2 : 3;
    const styleRefPaths = resolveStyle01StyleReferencePaths(assembled.sceneClass, styleRefCount);
    const includeChildPhoto = childPresenceAllowsReferencePhoto(assembled.entityPresence.childPresence);
    const { paths: finalRefs, breakdown } = assembleStyle01BookReferences({
      styleRefPaths,
      childPhotoPath: refConfig === 'C' ? undefined : SIMULATED_CHILD_ANCHOR,
      companionRefPaths: refConfig === 'B' ? undefined : companionRefPaths,
      otherCharacterRefPaths: [],
      config: refConfig,
      includeChildPhoto,
      useMultiCompanionSheets,
    });
    return { assembled, finalRefs, breakdown, label: input.label };
  };

  const targets = [
    {
      pageNumber: 0,
      rawScenePrompt: story.coverSceneHint ?? story.pages[0]?.rawScenePrompt,
      imagePrompt: story.coverSceneHint ?? story.pages[0]?.imagePrompt ?? '',
      bookPageText: story.title,
      label: 'cover',
      assetType: 'cover' as const,
    },
    ...MANIFEST_PAGES.map((n) => {
      const p = story.pages.find((sp) => sp.pageNumber === n);
      if (!p) throw new Error(`page ${n} missing from bank story`);
      return {
        pageNumber: p.pageNumber,
        rawScenePrompt: p.rawScenePrompt,
        imagePrompt: p.imagePrompt,
        bookPageText: p.text,
        imageSubject: p.imageSubject,
        isLetter: p.isLetter,
        label: `p${n}`,
      };
    }),
  ];

  for (const t of targets) {
    const { assembled, finalRefs, breakdown, label } = assembleFor(t);
    const prompt = assembled.prompt;

    // C1: registry lock present, contamination absent
    const lockOk =
      /cream-white/i.test(prompt) && /heart-shaped badge/i.test(prompt) && /floppy ears/i.test(prompt);
    const dirty = /stuffed/i.test(prompt) || /\bgray fur\b/i.test(prompt) || /armadillo/i.test(prompt);
    const companionPresent = assembled.entityPresence.companionPresence === 'present';
    check(
      `C1-${label}`,
      `[${label}] COMPANION LOCK is registry bunny text (when companion present)`,
      companionPresent ? lockOk && !dirty : !dirty,
      `companionPresence=${assembled.entityPresence.companionPresence} registryText=${lockOk} contaminated=${dirty}`
    );

    // C2: no DNA fragments
    const dnaFragments = [contaminatedDNA.slice(0, 40), contaminatedStructured.coloring]
      .filter(Boolean)
      .filter((f) => f.length > 8 && prompt.includes(f));
    check(`C2-${label}`, `[${label}] no dna.companionDNA text in prompt`, dnaFragments.length === 0, dnaFragments.join(' | ') || 'clean');

    // C4 per-target: style refs from approved set only
    const styleBasenames = breakdown.style.map((r) => path.basename(r));
    const styleBad = styleBasenames.filter((b) => !APPROVED_STYLE_REFS.includes(b));
    check(`C4-${label}`, `[${label}] style refs ⊆ approved character-free set`, styleBad.length === 0, styleBasenames.join(', '));

    // C5: child anchor binding + setting lock
    const childExpected = assembled.entityPresence.childPresence === 'present';
    const childBound = breakdown.child.length > 0;
    check(
      `C5a-${label}`,
      `[${label}] child anchor bound when child present`,
      childExpected ? childBound : true,
      `childPresence=${assembled.entityPresence.childPresence} bound=${childBound}`
    );
    const settingOk = /SCENARIO SETTING LOCK/.test(prompt) && /pediatric clinic/i.test(prompt);
    check(`C5b-${label}`, `[${label}] scenarioSettingLock (clinic) present`, settingOk, settingOk ? 'present' : 'MISSING');

    // P-series: smoke #2 visual-polish lines
    if (label === 'cover') {
      const coverLocks =
        /CHILD VISUAL LOCK/.test(prompt) &&
        /BOOK WARDROBE LOCK/.test(prompt) &&
        /CHILD ANATOMICAL LOCK/.test(prompt) &&
        /COVER COMPOSITION/.test(prompt);
      check(`P1-${label}`, `[${label}] full child locks + cover composition`, coverLocks, coverLocks ? 'present' : 'MISSING');
    }
    if (label === 'p1') {
      const p1Polish =
        /PAGE EXPRESSION:.*curious and slightly nervous/i.test(prompt) &&
        /PAGE SCENE FIDELITY/.test(prompt) &&
        /INSIDE the clinic room/.test(prompt);
      check(`P2-${label}`, `[${label}] PAGE EXPRESSION + p1 scene fidelity`, p1Polish, p1Polish ? 'present' : 'MISSING');
    }
    if (label === 'p6') {
      const p6Polish =
        /PAGE EXPRESSION:.*NOT a broad smile/i.test(prompt) &&
        /SCENE INTERACTION \/ GAZE/.test(prompt);
      check(`P3-${label}`, `[${label}] brave expression + mutual gaze`, p6Polish, p6Polish ? 'present' : 'MISSING');
    }
    const sizeOk = /COMPANION SIZE vs CHILD/.test(prompt) && /25–35%/.test(prompt);
    check(`P4-${label}`, `[${label}] companion size anchor (registry + prompt line)`, sizeOk, sizeOk ? 'present' : 'MISSING');

    push(`## ${label === 'cover' ? 'Cover' : `Page ${t.pageNumber}`}`);
    push();
    if (label === 'cover') {
      push(
        '> NOTE: the real cover path (`runCoverStage` → `generateBookCover`) ALWAYS passes ' +
          '`config.referenceImages` with the approved child anchor first, independent of the ' +
          'presence detection shown here (cover hint may omit the child by name).'
      );
      push();
    }
    push(`- entityPresence: child=\`${assembled.entityPresence.childPresence}\` companion=\`${assembled.entityPresence.companionPresence}\``);
    push(`- sceneClass: \`${assembled.sceneClass}\` · effectivePageTimeOfDay: \`${assembled.effectivePageTimeOfDay}\``);
    push(`- child ref: ${breakdown.child.length ? `bound → \`${breakdown.child[0]}\`` : '(not bound)'} `);
    push(`- companion refs: ${breakdown.companion.map((r) => `\`${path.basename(r)}\``).join(', ') || '(none)'}`);
    push(`- style refs: ${breakdown.style.map((r) => `\`${path.basename(r)}\``).join(', ')}`);
    push(`- final reference order: ${finalRefs.map((r) => (r.includes('style-references') ? `STYLE:${path.basename(r)}` : r.includes('style01-sheets') ? `SHEET:${path.basename(r)}` : r === SIMULATED_CHILD_ANCHOR ? 'CHILD_ANCHOR(sim)' : path.basename(r))).join(' → ')}`);
    push();
    push('<details><summary>Assembled prompt (deterministic)</summary>');
    push();
    push(fence(prompt));
    push();
    push('</details>');
    push();
  }

  // ── Verdict ──
  const failed = checks.filter((c) => !c.pass);
  push('## Checklist verdict');
  push();
  push('| check | result | detail |');
  push('|---|---|---|');
  for (const c of checks) {
    push(`| ${c.id} — ${c.label} | ${c.pass ? '✅ PASS' : '❌ FAIL'} | ${c.detail.replace(/\|/g, '/')} |`);
  }
  push();
  push(failed.length === 0 ? '**ALL CHECKS PASS — cleared for the 3-page LOW smoke render (pending Guy+Claude review).**' : `**${failed.length} CHECK(S) FAILED — do NOT render.**`);
  push();
  push(`Fresh dev order for the smoke render: \`${orderId}\``);

  const outFile = path.join(process.cwd(), 'outputs', `dry-run-bunny-manifest-${orderId.slice(0, 9)}.md`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`[dry-run] wrote ${outFile}`);
  console.log(`[dry-run] fresh orderId=${orderId}`);
  for (const c of checks) console.log(`[dry-run] ${c.pass ? 'PASS' : 'FAIL'} ${c.id} ${c.label} :: ${c.detail.slice(0, 140)}`);
  if (failed.length > 0) {
    console.error(`[dry-run] ${failed.length} checks FAILED`);
    process.exit(2);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
