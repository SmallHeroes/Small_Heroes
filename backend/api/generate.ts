/**
 * Generation Orchestrator
 * Triggered after successful payment.
 * Runs story → images → audio → package pipeline.
 *
 * File: app/api/generate/route.ts (also exported as a function)
 */

import { PrismaClient } from '@prisma/client';
import { generateStory, StoryInput } from '../providers/story';
import { generateAllPageImages } from '../providers/image';
import { generateAudio, buildNarrationScript } from '../providers/audio';
import { TOPICS } from '../config/wizard';
import { sendBookReadyEmail } from '../lib/email';

const prisma = new PrismaClient();

// ─── Main Orchestrator ────────────────────────────────
export async function triggerGeneration(orderId: string): Promise<void> {
  console.log(`[Generation] Starting pipeline for order ${orderId}`);

  // Mark as generating
  await prisma.order.update({
    where: { id: orderId },
    data: { status: 'generating' },
  });

  // Create or find generation job
  const job = await prisma.generationJob.upsert({
    where: { orderId },
    update: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
    create: { orderId, status: 'running', startedAt: new Date(), attempts: 1 },
  });

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`Order ${orderId} not found`);

    const topicLabel = TOPICS.find(t => t.id === order.topic)?.label ?? order.topic;

    // ── Stage 1: Generate Story Text ──────────────────
    console.log(`[Generation] ${orderId} — Stage 1: Story text`);
    await prisma.order.update({ where: { id: orderId }, data: { textStatus: 'running' } });

    const storyInput: StoryInput = {
      childName:        order.childName,
      childAge:         order.childAge,
      childGender:      order.childGender,
      childTraits:      order.childTraits,
      childSuperpower:  (order as any).childSuperpower ?? null,
      familyContext:    (order as any).familyContext    ?? null,
      topic:            order.topic,
      topicLabel,
      challengeItems:   order.challengeItems,
      challengeFree:    order.challengeFree  ?? undefined,
      outcomeItems:     order.outcomeItems,
      outcomeFree:      order.outcomeFree    ?? undefined,
      helperItems:      order.helperItems,
      helperFree:       order.helperFree     ?? undefined,
      avoidItems:       order.avoidItems,
      avoidFree:        order.avoidFree      ?? undefined,
      storyLength:      order.storyLength as 'short' | 'medium' | 'long',
      illustrationStyle: order.illustrationStyle,
      childImageUrl:    order.childImageUrl ?? null,
    };

    const story = await generateStory(storyInput);

    // Create GeneratedBook record
    const book = await prisma.generatedBook.create({
      data: {
        orderId,
        title: order.bookName || story.title,
        coverText: story.coverText,
      },
    });

    // Create BookPage records
    await prisma.bookPage.createMany({
      data: story.pages.map(p => ({
        bookId:        book.id,
        pageNumber:    p.pageNumber,
        text:          p.text,
        narrationText: p.narrationText,
        // imageSubject and imagePrompt stored for debugging/regeneration
        // (no-op if columns don't exist yet — add via: prisma db push)
        ...(p.imageSubject ? { imageSubject: p.imageSubject } : {}),
      })),
    });

    await prisma.order.update({ where: { id: orderId }, data: { textStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId }, data: { textDone: true } });
    console.log(`[Generation] ${orderId} — Story text done (${story.pages.length} pages)`);

    // ── Stage 2: Generate Images ───────────────────────
    console.log(`[Generation] ${orderId} — Stage 2: Images`);
    await prisma.order.update({ where: { id: orderId }, data: { imageStatus: 'running' } });

    const clothingLock = story.heroVisualLock?.clothing?.trim();
    const childDescBase = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old, warm and friendly appearance`;
    const childDesc = clothingLock ? `${childDescBase}; wearing ${clothingLock}` : childDescBase;

    const imageOutcome = await generateAllPageImages(
      story.pages.map((p, idx) => {
        const plan = story.pageCompositionPlan?.find((cp) => cp.pageNumber === p.pageNumber);
        const prev = idx > 0 ? story.pages[idx - 1] : null;
        return {
          pageNumber: p.pageNumber,
          imagePrompt: p.imagePrompt,
          rawScenePrompt: p.rawScenePrompt,
          visualDirection: p.visualDirection,
          bookPageText: p.text,
          pageIntent: plan?.pageIntent,
          composition: plan
            ? {
                cameraDistance: plan.cameraDistance,
                cameraAngle: plan.cameraAngle,
                compositionType: plan.compositionType,
                heroPlacement: plan.heroPlacement,
                entityPlacement: plan.entityPlacement,
                topTextAreaPlan: plan.topTextAreaPlan,
                mainIllustrationZone: plan.mainIllustrationZone,
              }
            : undefined,
          compositionRules: plan
            ? `camera=${plan.cameraDistance}/${plan.cameraAngle}; type=${plan.compositionType}; topText=${plan.topTextAreaPlan}; mainZone=${plan.mainIllustrationZone}`
            : undefined,
          environmentContinuity: prev ? `continue visual rhythm from page ${prev.pageNumber}` : 'opening page',
        };
      }),
      {
        illustrationStyle: order.illustrationStyle,
        childName: order.childName ?? null,
        childDescription: childDesc,
        referenceImages: order.childImageUrl ? [order.childImageUrl] : undefined,
        orderId,
        heroVisualLock: story.heroVisualLock,
        styleLock: story.styleLock,
        entityVisualLock: story.entityVisualLock,
      }
    );
    const imageMap = imageOutcome.results;

    // Save image assets — link to book pages
    const pages = await prisma.bookPage.findMany({ where: { bookId: book.id } });
    for (const page of pages) {
      const image = imageMap.get(page.pageNumber);
      if (image) {
        await prisma.imageAsset.create({
          data: {
            pageId: page.id,
            provider: image.provider,
            prompt: image.prompt,
            url: image.url,
            rawUrl: image.rawUrl ?? null,
            width: image.width,
            height: image.height,
            style: order.illustrationStyle,
          },
        });
      }
    }

    await prisma.order.update({ where: { id: orderId }, data: { imageStatus: 'done' } });
    await prisma.generationJob.update({ where: { orderId }, data: { imagesDone: true } });
    console.log(
      `[Generation] ${orderId} — Images done (${imageMap.size}/${story.pages.length}); failedPages=[${imageOutcome.failedPages.join(', ')}]`
    );

    // ── Stage 3: Generate Audio (optional) ────────────
    if (order.audioEnabled && order.selectedVoice) {
      console.log(`[Generation] ${orderId} — Stage 3: Audio (voice=${order.selectedVoice})`);
      await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'running' } });

      try {
        const narrationScript = buildNarrationScript(
          story.pages.map(p => ({ pageNumber: p.pageNumber, narrationText: p.narrationText })),
          order.sleepMode
        );

        const audio = await generateAudio({
          narrationScript,
          voiceId: order.selectedVoice,
          sleepMode: order.sleepMode,
          orderId,
        });

        await prisma.audioAsset.create({
          data: {
            bookId: book.id,
            provider: audio.provider,
            voiceId: audio.voiceId,
            // elevenlabsVoiceId omitted — field not in AudioAsset schema.
            // Recoverable at any time via getVoiceById(voiceId).elevenlabsVoiceId.
            sleepMode: order.sleepMode,
            url: audio.url,
          },
        });

        await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'done' } });
        await prisma.generationJob.update({ where: { orderId }, data: { audioDone: true } });
        console.log(`[Generation] ${orderId} — Audio done`);

      } catch (audioErr) {
        console.error(`[Generation] ${orderId} — Audio failed (non-fatal):`, audioErr);
        await prisma.order.update({
          where: { id: orderId },
          data: {
            audioStatus: 'failed',
            lastError: String(audioErr),
            // Don't set status to 'failed' — book can still be delivered
          },
        });
      }
    } else {
      await prisma.order.update({ where: { id: orderId }, data: { audioStatus: 'done' } });
    }

    // ── Stage 4: Package & Mark Ready ─────────────────
    console.log(`[Generation] ${orderId} — Stage 4: Packaging`);
    await prisma.order.update({ where: { id: orderId }, data: { packageStatus: 'running' } });

    let pdfUrl: string | null = null;
    if (order.pdfEnabled) {
      try {
        console.log(`[Generation] ${orderId} — Generating PDF...`);
        const [{ generateBookPdf }, { uploadPdfToStorage }] = await Promise.all([
          import('../lib/pdf-generator'),
          import('../lib/pdf-storage'),
        ]);
        const dbPages = await prisma.bookPage.findMany({
          where: { bookId: book.id },
          orderBy: { pageNumber: 'asc' },
          select: {
            pageNumber: true,
            text: true,
            imageAsset: { select: { presentationUrl: true, url: true } },
          },
        });
        const pdfBuffer = await generateBookPdf({
          title: book.title || order.childName || 'הספר שלי',
          pages: [
            ...(book.coverImageUrl
              ? [{ pageNumber: 0, text: '', imageUrl: book.coverImageUrl, isCover: true }]
              : []),
            ...dbPages.map((page) => ({
              pageNumber: page.pageNumber + (book.coverImageUrl ? 1 : 0),
              text: page.text,
              imageUrl: page.imageAsset?.presentationUrl ?? page.imageAsset?.url ?? null,
            })),
          ],
        });
        pdfUrl = await uploadPdfToStorage(orderId, pdfBuffer);
        await prisma.generatedBook.update({
          where: { id: book.id },
          data: { pdfUrl },
        });
        console.log(`[Generation] ${orderId} — PDF generated: ${pdfUrl}`);
      } catch (pdfErr) {
        console.error(`[Generation] ${orderId} — PDF generation failed:`, pdfErr);
      }
    }

    // Set public read URL — points to the ready screen, which is the book home
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const readUrl = `${appUrl}/ready?orderId=${orderId}`;
    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { readUrl },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: imageOutcome.failedPages.length > 0 ? 'partial' : 'ready',
        packageStatus: 'done',
      },
    });

    await prisma.generationJob.update({
      where: { orderId },
      data: { status: 'done', completedAt: new Date(), packaged: true },
    });

    console.log(`[Generation] ${orderId} — COMPLETE ✓`);

    // Send completion email — non-fatal if it fails
    try {
      const finishedBook = await prisma.generatedBook.findUnique({
        where: { id: book.id },
        include: { audioAsset: true },
      });
      await sendBookReadyEmail({
        to:           order.customerEmail,
        customerName: order.customerName ?? order.childName,
        childName:    order.childName,
        readUrl,
        audioUrl:     finishedBook?.audioAsset?.url ?? undefined,
        pdfUrl:       finishedBook?.pdfUrl            ?? undefined,
      });
      console.log(`[Generation] ${orderId} — Ready email sent to ${order.customerEmail}`);
    } catch (emailErr) {
      console.error(`[Generation] ${orderId} — Ready email failed (non-fatal):`, emailErr);
    }

  } catch (error) {
    console.error(`[Generation] ${orderId} FAILED:`, error);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'failed',
        lastError: String(error),
        errorAt: new Date(),
      },
    });

    await prisma.generationJob.update({
      where: { orderId },
      data: {
        status: 'failed',
        failedAt: new Date(),
        lastError: String(error),
      },
    }).catch(() => {});

    throw error; // Re-throw so caller can handle
  }
}

// ─── API Route Handler (manual trigger / webhook fallback) ───
// File: app/api/generate/route.ts
export async function POST(req: Request) {
  try {
    const { orderId, secret } = await (req as any).json();

    // Basic auth for manual trigger
    if (secret !== process.env.GENERATION_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 });

    // Trigger async — respond immediately
    triggerGeneration(orderId).catch(err =>
      console.error(`[API Generate] ${orderId} failed:`, err)
    );

    return Response.json({ started: true, orderId });

  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
