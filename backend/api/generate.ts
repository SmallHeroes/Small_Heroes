/**
 * Generation Orchestrator
 * Triggered after successful payment.
 * Runs story → images → audio → package pipeline.
 *
 * File: app/api/generate/route.ts (also exported as a function)
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { generateStory, StoryInput } from '../providers/story';
import { generateAllPageImages } from '../providers/image';
import { generateAudio, buildNarrationScript } from '../providers/audio';
import { TOPICS } from '../config/wizard';
import { sendBookReadyEmail } from '../lib/email';
import { ROUTES } from '../../lib/routes';

const prisma = new PrismaClient();
const GENERATION_ELIGIBLE_STATUS = 'paid';

// ─── Main Orchestrator ────────────────────────────────
export async function triggerGeneration(orderId: string): Promise<void> {
  if (!orderId) {
    console.warn('[Legacy Generation] skipped — invalid orderId');
    return;
  }
  console.log(`[Generation] Starting pipeline for order ${orderId}`);

  // Create row if needed (race-safe), then claim via updateMany.
  try {
    await prisma.generationJob.create({
      data: { orderId, status: 'pending', attempts: 0 },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      throw error;
    }
  }
  await prisma.generationJob.updateMany({
    where: { orderId, status: { not: 'running' } },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  });

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (order.status === 'ready' || order.status === 'partial') {
      console.warn(`[Legacy Generation] blocked — already completed orderId=${orderId} status=${order.status}`);
      return;
    }
    if (order.status === 'generating') {
      console.warn(`[Legacy Generation] blocked — already generating orderId=${orderId}`);
      return;
    }
    if (order.status !== GENERATION_ELIGIBLE_STATUS || !order.stripePaid) {
      console.warn(
        `[Legacy Generation] blocked — order not eligible orderId=${orderId} status=${order.status} stripePaid=${order.stripePaid}`
      );
      return;
    }

    const claimedOrder = await prisma.order.updateMany({
      where: { id: orderId, status: GENERATION_ELIGIBLE_STATUS, stripePaid: true },
      data: { status: 'generating' },
    });
    if (claimedOrder.count === 0) {
      console.warn(`[Legacy Generation] blocked — order could not be claimed orderId=${orderId}`);
      return;
    }

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
        title: story.title,
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

    const childDesc = `A ${order.childGender === 'girl' ? 'girl' : 'boy'} named ${order.childName}, approximately ${order.childAge ?? 5} years old, warm and friendly appearance`;

    const imageMap = await generateAllPageImages(
      story.pages.map((p, idx) => {
        const plan = story.pageCompositionPlan?.find((cp) => cp.pageNumber === p.pageNumber);
        const prev = idx > 0 ? story.pages[idx - 1] : null;
        return {
          pageNumber: p.pageNumber,
          imagePrompt: p.imagePrompt,
          pageIntent: plan?.pageIntent,
          compositionRules: plan
            ? `camera=${plan.cameraDistance}/${plan.cameraAngle}; type=${plan.compositionType}; topText=${plan.topTextAreaPlan}; mainZone=${plan.mainIllustrationZone}`
            : undefined,
          environmentContinuity: prev ? `continue visual rhythm from page ${prev.pageNumber}` : 'opening page',
        };
      }),
      {
        illustrationStyle: order.illustrationStyle,
        childDescription: childDesc,
        referenceImages: order.childImageUrl ? [order.childImageUrl] : undefined,
        orderId,
        heroVisualLock: story.heroVisualLock,
        styleLock: story.styleLock,
        entityVisualLock: story.entityVisualLock,
      }
    );

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
    console.log(`[Generation] ${orderId} — Images done (${imageMap.size}/${story.pages.length})`);

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

    // TODO: Generate PDF if pdfEnabled
    // const pdfUrl = order.pdfEnabled ? await generatePDF(book) : null;
    // if (pdfUrl) await prisma.generatedBook.update({ where:{id:book.id}, data:{pdfUrl} });

    // Set public read URL — points to the ready screen, which is the book home
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const readUrl = `${appUrl}${ROUTES.ready}?orderId=${orderId}`;
    await prisma.generatedBook.update({
      where: { id: book.id },
      data: { readUrl },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'ready',
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
    if (!process.env.GENERATION_SECRET || secret !== process.env.GENERATION_SECRET) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!orderId) return Response.json({ error: 'orderId required' }, { status: 400 });
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, stripePaid: true },
    });
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== GENERATION_ELIGIBLE_STATUS || !order.stripePaid) {
      return Response.json({ error: 'Order is not eligible for generation' }, { status: 409 });
    }

    // Trigger async — respond immediately
    triggerGeneration(orderId).catch(err =>
      console.error(`[API Generate] ${orderId} failed:`, err)
    );

    return Response.json({ started: true, orderId });

  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
