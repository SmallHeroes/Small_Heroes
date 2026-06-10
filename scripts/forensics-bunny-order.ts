/**
 * Forensic render manifest for a failed style01 book render — NO rendering.
 *
 * Reconstructs, per page + cover: prompt (deterministic assembly), reference
 * list, entityPresence, sceneClass, refConfig — from DB order/job/book +
 * pipeline cache + the SAME resolver functions the pipeline uses.
 *
 * KNOWN LIMIT (stated in the report): the per-page `pagePrompt` fed to the
 * style01 assembler at render time was composed from an LLM storyboard
 * (generateStoryboard → OpenAI) that is not persisted; here we feed the
 * deterministic fallback. For style01 the SCENE comes from rawScenePrompt
 * (bank imageDirection), which wins over pagePrompt in
 * resolveStyle01SceneDescription, so lock/scene reconstruction is faithful;
 * presence detection additionally scans pagePrompt, noted where relevant.
 *
 * Usage:
 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/forensics-bunny-order.ts [orderId]
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { parsePipelineCache } from '../lib/generation-pipeline/helpers';
import {
  getApprovedChildCanonicalAnchor,
  getCharacterAnchorStore,
  getChildCanonicalAnchor,
} from '../lib/generation-pipeline/character-anchor-store';
import {
  buildImagePipelineAnchors,
  detectExpectedCharactersForPage,
  resolveCompanionForOrder,
} from '../lib/generation-pipeline/anchor-registry';
import { companionAnchorKey, getWizardMeta } from '../lib/orderMeta';
import { loadStoryFromBank } from '../backend/providers/story-bank-loader';
import { buildEnrichedScenePrompt, deriveLayout } from '../backend/providers/image-prompt-enricher';
import { assembleStyle01Phase2Prompt } from '../lib/style01-prompt-assembly';
import {
  assembleStyle01BookReferences,
  resolveStyle01CompanionReferencePaths,
  resolveStyle01RefBudgetConfig,
  resolveStyle01StyleReferencePaths,
} from '../lib/style01-gptimage';
import { childPresenceAllowsReferencePhoto } from '../lib/image-entity-presence';
import { mergeGptImageReferenceSources } from '../lib/image-reference-utils';
import {
  isChildExpressionSheetActive,
  resolveApprovedExpressionAnchorUrl,
} from '../lib/generation-pipeline/child-expression-sheet';
import { resolveChildExpressionKindForPage } from '../lib/generation-pipeline/child-expression-page-map';

// Read-only diagnostic: allow sheet-less companion ref resolution so the report
// can describe historical renders that predate the hard-fail gate.
process.env.ALLOW_SINGLE_IMAGE_COMPANION_REF ??= 'true';

const ORDER_ID = process.argv[2] || 'cmq82b5f300024wyolypqecob';
const OUT_FILE = path.join(process.cwd(), 'outputs', `forensics-bunny-${ORDER_ID.slice(0, 9)}.md`);

const CONTAMINATION_TERMS = ['armadillo', 'bolly', 'anat', 'dini', 'bunny', 'rabbit', 'companionId'];

function grepTerms(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const term of CONTAMINATION_TERMS) {
    const re = new RegExp(term, 'gi');
    const n = (text.match(re) ?? []).length;
    if (n > 0) counts[term] = n;
  }
  return counts;
}

function fence(s: string | null | undefined): string {
  return '```\n' + (s ?? '(empty)') + '\n```';
}

async function main() {
  const order = await prisma.order.findUnique({ where: { id: ORDER_ID } });
  if (!order) throw new Error(`Order ${ORDER_ID} not found`);
  const job = await prisma.generationJob.findUnique({ where: { orderId: ORDER_ID } });
  if (!job) throw new Error(`GenerationJob for ${ORDER_ID} not found`);
  const book = await prisma.generatedBook.findUnique({
    where: { orderId: ORDER_ID },
    include: { pages: { include: { imageAsset: true }, orderBy: { pageNumber: 'asc' } } },
  });
  if (!book) throw new Error(`GeneratedBook for ${ORDER_ID} not found`);

  const cache = parsePipelineCache(job.pipelineCache);
  const wizardMeta = getWizardMeta(order.characterAnchors);
  const companion = resolveCompanionForOrder(order);
  const anchorStore = getCharacterAnchorStore(cache);
  const childAnchor = getChildCanonicalAnchor(cache);
  const approvedChildAnchor = getApprovedChildCanonicalAnchor(cache);
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const storyFilePath = cache.devStoryBankFile ?? cache.storyFilePath;
  if (!storyFilePath) throw new Error('storyFilePath missing from cache');

  // Import traceability (v3-approved)
  let importMeta: string | null = null;
  const importJsonPath = storyFilePath.replace(/\.md$/, '.import.json');
  if (fs.existsSync(importJsonPath)) importMeta = fs.readFileSync(importJsonPath, 'utf8');

  const story = await loadStoryFromBank(
    storyFilePath,
    order.childName || '',
    companion?.name ?? 'צפרדע',
    order.childGender || undefined,
    { skipLlmPersonalization: true }
  );

  // ── Companion reference resolution (same resolver as render path) ──
  const sheetsDir = companion
    ? path.join(process.cwd(), 'public', 'companions', companion.id, 'style01-sheets')
    : null;
  const sheetsDirExists = sheetsDir ? fs.existsSync(sheetsDir) : false;

  // ── Anchor registries exactly as runPageImagesChunk builds them ──
  const { anchorRegistry, initialCharacterAnchors } = buildImagePipelineAnchors({
    order,
    lockedChildDescription: cache.lockedChildDescription ?? cache.dna?.childDNA ?? '',
    resolvedCompanion: companion,
    characterSheet: story.characterSheet,
    appBaseUrl,
  });

  const gptReferenceImages = approvedChildAnchor?.url
    ? mergeGptImageReferenceSources(approvedChildAnchor.url, companion, appBaseUrl)
    : undefined;
  const expressionActive = isChildExpressionSheetActive(cache);
  const refConfig = resolveStyle01RefBudgetConfig();

  const dbTextByPage = new Map(book.pages.map((p) => [p.pageNumber, p.text]));

  const lines: string[] = [];
  const push = (s = '') => lines.push(s);

  push(`# Forensic Render Manifest — order \`${ORDER_ID}\``);
  push();
  push(`Generated: ${new Date().toISOString()} · method: DB + pipeline cache + deterministic re-run of the SAME assembly/resolver functions (no images generated).`);
  push();
  push('## Order / story identity');
  push();
  push(`| field | value |`);
  push(`|---|---|`);
  push(`| orderId | \`${order.id}\` |`);
  push(`| storyFilePath (cache) | \`${storyFilePath}\` |`);
  push(`| bankDir | \`${path.basename(path.dirname(storyFilePath))}\` |`);
  push(`| storyBankVersion (cache) | \`${cache.storyBankVersion ?? '(unset)'}\` |`);
  push(`| selectionFilename (cache) | \`${cache.selectionFilename ?? '(unset)'}\` |`);
  push(`| directionForV3 (cache) | \`${cache.directionForV3 ?? '(unset)'}\` |`);
  push(`| challengeCategory (cache) | \`${cache.challengeCategory ?? '(unset)'}\` |`);
  push(`| order.storyDirection / topic | \`${order.storyDirection}\` / \`${order.topic}\` |`);
  push(`| wizardMeta.companionCharacterId | \`${wizardMeta.companionCharacterId ?? '(unset)'}\` |`);
  push(`| wizardMeta.challengeCategory | \`${wizardMeta.challengeCategory ?? '(unset)'}\` |`);
  push(`| resolved companion | \`${companion?.id ?? '(none)'}\` (${companion?.name ?? '-'}) image=\`${companion?.image ?? '-'}\` |`);
  push(`| companion style01-sheets dir | \`${sheetsDir}\` exists=${sheetsDirExists} |`);
  push(`| child | name=\`${order.childName}\` gender=\`${order.childGender}\` age=${order.childAge} |`);
  push(`| childImageUrl | ${order.childImageUrl ? `set (\`${order.childImageUrl.slice(0, 90)}…\`)` : 'NONE'} |`);
  push(`| photoQuality (wizard) | \`${JSON.stringify(wizardMeta.photoQuality ?? null)}\` |`);
  push(`| illustrationStyle / model / quality | \`${order.illustrationStyle}\` / \`${process.env.STYLE_01_GPT_MODEL ?? 'gpt-image-1'}\` / \`${process.env.GPT_IMAGE_QUALITY ?? '(unset→low)'}\` |`);
  push(`| refConfig | \`${refConfig}\` |`);
  push(`| story title / pages | ${story.title} / ${story.pages.length} |`);
  push();
  if (importMeta) {
    push('### v3 import traceability (`.import.json`)');
    push();
    push(fence(importMeta));
    push();
  }

  push('## Cache keys present');
  push();
  push(fence(Object.keys(cache as Record<string, unknown>).join(', ')));
  push();

  push('## Child DNA / locks (cache)');
  push();
  push(`**lockedChildDescription:**`);
  push();
  push(fence(cache.lockedChildDescription ?? '(unset)'));
  push();
  push(`**dna.childDNA:**`);
  push();
  push(fence(cache.dna?.childDNA ?? '(unset)'));
  push();
  push(`**childPhotoDescription:**`);
  push();
  push(fence(cache.childPhotoDescription ?? '(unset)'));
  push();
  push(`**dna.childStructured:** \`${JSON.stringify(cache.dna?.childStructured ?? null)}\``);
  push();
  push(`**dna.companionDNA:**`);
  push();
  push(fence(cache.dna?.companionDNA ?? '(unset)'));
  push();

  push('## Stage-0 child anchor');
  push();
  push(`| field | value |`);
  push(`|---|---|`);
  push(`| anchor url | \`${childAnchor?.url ?? '(none)'}\` |`);
  push(`| qaStatus | \`${childAnchor?.qaStatus ?? '-'}\` |`);
  push(`| approved (cache.childAnchorApproved) | ${cache.childAnchorApproved === true} |`);
  push(`| resemblanceScore | ${childAnchor?.resemblanceScore ?? '-'} |`);
  push(`| source / provider / model | ${childAnchor?.source} / ${childAnchor?.provider} / ${childAnchor?.model} |`);
  push(`| stage0SelectedAttempt | ${cache.stage0SelectedAttempt ?? '-'} |`);
  push(`| stage0 candidates | ${(cache.stage0AnchorCandidates ?? []).map((c) => `#${c.attempt}:${(c.resemblanceScore ?? 0).toFixed(3)}${c.passed ? '✓' : ''}`).join(' ') || '(none)'} |`);
  push(`| expression sheet active | ${expressionActive} |`);
  push(`| expression anchors | ${JSON.stringify(Object.fromEntries(Object.entries(cache.childExpressionSheet?.anchors ?? {}).map(([k, v]) => [k, { qa: v?.qaStatus, url: v?.url?.slice(-40) }])))} |`);
  push();
  push('**stage0AnchorPrompt (exact, from cache):**');
  push();
  push(fence(cache.stage0AnchorPrompt ?? '(unset)'));
  push();
  push('## characterAnchorStore (cache) — all entries');
  push();
  for (const [key, entry] of Object.entries(anchorStore)) {
    push(`- \`${key}\`: qa=\`${entry.qaStatus}\` orderId=\`${entry.orderId}\` url=\`${entry.url}\` score=${entry.resemblanceScore ?? '-'} source=${entry.source}`);
  }
  push();
  push('## initialCharacterAnchors passed to generateAllPageImages');
  push();
  for (const [k, v] of Object.entries(initialCharacterAnchors)) push(`- \`${k}\` → \`${v}\``);
  push();
  push(`**gptReferenceImages (config.referenceImages — child anchor first, companion single image second):**`);
  push();
  for (const r of gptReferenceImages ?? []) push(`- \`${r}\``);
  push();

  // ── Per-page reconstruction ──
  push('## Per-page reconstruction');
  push();
  const allContamination: Array<{ page: number | 'cover'; where: string; counts: Record<string, number> }> = [];

  const pagesWithChars = story.pages.map((p) => {
    const baseIds = detectExpectedCharactersForPage(
      { text: p.text, imagePrompt: p.imagePrompt, imageSubject: p.imageSubject ?? '' },
      anchorRegistry
    );
    const subj = (p.imageSubject ?? '').toLowerCase();
    const expectedCharacterIds =
      companion && !subj.startsWith('environment') && !subj.startsWith('object:')
        ? [...new Set([...baseIds, companionAnchorKey(companion.id)])]
        : baseIds;
    return { ...p, expectedCharacterIds };
  });

  for (const p of pagesWithChars) {
    const pageLayout = deriveLayout({
      pageNumber: p.pageNumber,
      totalPages: story.pages.length,
      text: p.text,
      isLetter: Boolean(p.isLetter),
    });
    const enriched = buildEnrichedScenePrompt({
      rawScenePrompt: p.rawScenePrompt,
      imagePrompt: p.imagePrompt,
      layout: pageLayout,
      text: p.text,
      textZone: null,
      isLetter: p.isLetter,
      pageNumber: p.pageNumber,
      totalPages: story.pages.length,
    });
    const bookPageText = dbTextByPage.get(p.pageNumber) ?? p.text;

    const assembled = assembleStyle01Phase2Prompt({
      pageNumber: p.pageNumber,
      totalPages: story.pages.length,
      pagePrompt: enriched.imagePrompt,
      rawScenePrompt: enriched.rawScenePrompt,
      bookPageText,
      childFirstName: order.childName,
      childAge: order.childAge,
      childGender: order.childGender,
      childDescription: cache.lockedChildDescription ?? cache.dna?.childDNA ?? '',
      childStructured: cache.dna?.childStructured,
      companion: companion
        ? { id: companion.id, name: companion.name, visualDescription: companion.visualDescription, image: companion.image }
        : null,
      companionStructured: cache.dna?.companionStructured,
      familyCoherence: cache.familyCoherence ?? null,
      storyRecurringEntityDeclarations: story.storyRecurringEntities,
      storyTimeOfDay: story.storyTimeOfDay,
      pageTimeOfDayOverrides: story.pageTimeOfDayOverrides,
    });

    const companionRefPaths =
      assembled.entityPresence.companionPresence === 'absent'
        ? []
        : resolveStyle01CompanionReferencePaths({
            companionId: companion?.id,
            companionImage: companion?.image,
            companionPresence: assembled.entityPresence.companionPresence,
            pageNumber: p.pageNumber,
            imagePrompt: enriched.imagePrompt,
            bookPageText,
            rawScenePrompt: enriched.rawScenePrompt,
          });
    const useMultiCompanionSheets = companionRefPaths.length >= 3;
    const styleRefCount = useMultiCompanionSheets ? 1 : refConfig === 'A' ? 2 : 3;
    const styleRefPaths = resolveStyle01StyleReferencePaths(assembled.sceneClass, styleRefCount);

    // Per-page child ref: expression-sheet kind when active, else canonical anchor.
    let childRefUrl = gptReferenceImages?.[0];
    let exprKind: string | null = null;
    if (expressionActive) {
      exprKind = resolveChildExpressionKindForPage({
        pageNumber: p.pageNumber,
        imagePrompt: p.imagePrompt,
        bookPageText,
        rawScenePrompt: enriched.rawScenePrompt,
        companionId: companion?.id ?? null,
      });
      childRefUrl =
        resolveApprovedExpressionAnchorUrl(cache, exprKind as never) ?? approvedChildAnchor?.url ?? childRefUrl;
    }

    const includeChildPhoto = childPresenceAllowsReferencePhoto(assembled.entityPresence.childPresence);
    const { paths: finalRefs, breakdown } = assembleStyle01BookReferences({
      styleRefPaths,
      childPhotoPath: refConfig === 'C' ? undefined : childRefUrl,
      companionRefPaths: refConfig === 'B' ? undefined : companionRefPaths,
      otherCharacterRefPaths: [],
      config: refConfig,
      includeChildPhoto,
      useMultiCompanionSheets,
    });

    const pageAsset = book.pages.find((bp) => bp.pageNumber === p.pageNumber);
    push(`### Page ${p.pageNumber}`);
    push();
    push(`- bookPageText (DB): ${bookPageText.slice(0, 160).replace(/\n/g, ' ')}…`);
    push(`- imageSubject: \`${p.imageSubject ?? '-'}\` · expectedCharacterIds: \`${JSON.stringify(p.expectedCharacterIds)}\``);
    push(`- entityPresence: child=\`${assembled.entityPresence.childPresence}\` companion=\`${assembled.entityPresence.companionPresence}\` recurring=\`${JSON.stringify(assembled.entityPresence.recurringEntities)}\``);
    push(`- sceneClass: \`${assembled.sceneClass}\` (storyTimeOfDay=\`${assembled.storyTimeOfDay}\`, effectivePageTimeOfDay=\`${assembled.effectivePageTimeOfDay}\`) · refConfig: \`${refConfig}\` · includeChildPhoto(by presence): **${includeChildPhoto}**`);
    push(`- child ref bound: ${breakdown.child.length > 0 ? `YES → \`${breakdown.child[0]}\`` : '**NO — no child identity reference passed on this page**'}${exprKind ? ` (expression kind=${exprKind})` : ''}`);
    push(`- companion refs: ${breakdown.companion.length ? breakdown.companion.map((r) => `\`${r}\``).join(', ') : '(none)'}`);
    push(`- style refs: ${breakdown.style.map((r) => `\`${path.basename(r)}\``).join(', ')}`);
    push(`- final reference order: ${finalRefs.map((r) => `\`${r.includes('style-references') ? 'STYLE:' + path.basename(r) : r.includes('character-anchors') ? 'CHILD_ANCHOR' : r}\``).join(' → ')}`);
    push(`- generated image asset: ${pageAsset?.imageAsset?.url ? `\`${pageAsset.imageAsset.url.slice(-60)}\`` : '(none)'}`);
    push();
    push('<details><summary>Reconstructed final prompt (deterministic assembly; see method note)</summary>');
    push();
    push(fence(assembled.prompt));
    push();
    push('</details>');
    push();

    allContamination.push({
      page: p.pageNumber,
      where: 'prompt',
      counts: grepTerms(assembled.prompt),
    });
    allContamination.push({
      page: p.pageNumber,
      where: 'refs',
      counts: grepTerms(finalRefs.join('\n')),
    });
  }

  // ── Cover ──
  push('## Cover');
  push();
  push('- Cover path: `runCoverStage` → `generateBookCover` → `buildCoverPrompt` (image.ts, not exported — same `generateImage`/style01 once-path as pages, `pageNumber=0`, `assetType=cover`).');
  push(`- Cover references (config.referenceImages = same \`gptReferenceImages\` merge as pages — child anchor + companion single image):`);
  for (const r of gptReferenceImages ?? []) push(`  - \`${r}\``);
  const coverCompanionRefs = resolveStyle01CompanionReferencePaths({
    companionId: companion?.id,
    companionImage: companion?.image,
    companionPresence: 'present',
    pageNumber: 0,
  });
  const coverStyleRefs = resolveStyle01StyleReferencePaths('default' as never, refConfig === 'A' ? 2 : 3);
  push(`- Cover companion resolver result: ${coverCompanionRefs.map((r) => `\`${r}\``).join(', ') || '(none)'}`);
  push(`- Cover style refs (sceneClass=default): ${coverStyleRefs.map((r) => `\`${path.basename(r)}\``).join(', ')}`);
  push(`- book.coverImageUrl: \`${book.coverImageUrl ?? '(none)'}\``);
  push();

  // ── Contamination grep ──
  push('## Contamination grep (Task 2)');
  push();
  push(`Terms: ${CONTAMINATION_TERMS.join(', ')}`);
  push();
  for (const row of allContamination) {
    if (Object.keys(row.counts).length === 0) continue;
    push(`- page ${row.page} [${row.where}]: ${JSON.stringify(row.counts)}`);
  }
  push();

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8');
  console.log(`[forensics] wrote ${OUT_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
