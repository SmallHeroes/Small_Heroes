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
      childName: order.childName,
      childAge: order.childAge,
      childGender: order.childGender,
      childTraits: order.childTraits,
      topic: order.topic,
      topicLabel,
      challengeItems: order.challengeItems,
      challengeFree: order.challengeFree ?? undefined,
      outcomeItems: order.outcomeItems,
      outcomeFree: order.outcomeFree ?? undefined,
      helperItems: order.helperItems,
      helperFree: order.helperFree ?? undefined,
      avoidItems: order.avoidItems,
      avoidFree: order.avoidFree ?? undefined,
      storyLength: order.storyLength as 'short' | 'medium' | 'long',
      illustrationStyle: order.illustrationStyle,
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
        bookId: book.id,
        pageNumber: p.pageNumber,
        text: p.text,
        narrationText: p.narrationText,
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
      story.pages.map(p => ({ pageNumber: p.pageNumber, imagePrompt: p.imagePrompt })),
      { illustrationStyle: order.illustrationStyle, childDescription: childDesc }
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
            elevenlabsVoiceId: audio.elevenlabsVoiceId,
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

    // Set public read URL
    const readUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${orderId}`;
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

    // TODO: Send completion email
    // await sendBookReadyEmail({ order, book, readUrl });

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
