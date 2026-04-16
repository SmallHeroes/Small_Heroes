/**
 * Orders API — Next.js App Router Route Handler
 * POST /api/orders — Create order from wizard data
 * GET  /api/orders/[id] — Get order status
 *
 * File: app/api/orders/route.ts  (Next.js App Router)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { computePricing } from '../../config/wizard';

const prisma = new PrismaClient();

// ─── POST /api/orders ─────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wizardData, sessionId } = body;

    if (!wizardData || !wizardData.child?.name || !wizardData.contact?.email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { child, topic, challenge, desiredOutcome, helpers, avoid, product, contact } = wizardData;
    const pricing = computePricing(product);

    // Upsert customer
    const customer = await prisma.customer.upsert({
      where: { email: contact.email },
      update: { name: contact.name },
      create: { email: contact.email, name: contact.name },
    });

    // Create or update wizard session
    let wizardSession = null;
    if (sessionId) {
      wizardSession = await prisma.wizardSession.upsert({
        where: { sessionId },
        update: { data: wizardData },
        create: { sessionId, data: wizardData },
      });
    }

    // Create order
    const order = await prisma.order.create({
      data: {
        status: 'draft',
        customerId: customer.id,
        customerEmail: contact.email,
        customerName: contact.name,

        // Child
        childName: child.name,
        childAge: child.age ? parseInt(child.age, 10) : null,
        childGender: child.gender || null,
        childTraits: child.traits || [],
        childImageUrl: child.imageUrl || null,

        // Story
        topic,
        challengeItems: challenge.selected || [],
        challengeFree: challenge.freeText || null,
        outcomeItems: desiredOutcome.selected || [],
        outcomeFree: desiredOutcome.freeText || null,
        helperItems: helpers.selected || [],
        helperFree: helpers.freeText || null,
        avoidItems: avoid.selected || [],
        avoidFree: avoid.freeText || null,

        // Product
        storyLength: product.length,
        illustrationStyle: product.illustrationStyle,
        audioEnabled: product.audioEnabled,
        selectedVoice: product.selectedVoice || null,
        sleepMode: product.sleepMode || false,
        pdfEnabled: product.pdfEnabled,
        bundleEnabled: product.bundleEnabled || false,

        // Pricing (stored in ILS as integer shekels)
        basePrice: pricing.basePrice * 100,    // in agorot
        addonsPrice: pricing.addonsPrice * 100,
        totalPrice: pricing.totalPrice * 100,

        // Wizard session link
        wizardSessionId: wizardSession?.id || null,
      },
    });

    return NextResponse.json({ orderId: order.id, totalPrice: pricing.totalPrice });

  } catch (error) {
    console.error('[POST /api/orders]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET /api/orders/[id] — Order Status ─────────────
// File: app/api/orders/[orderId]/route.ts
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: params.orderId },
      include: {
        book: {
          include: {
            pages: { orderBy: { pageNumber: 'asc' } },
            audioAsset: true,
          },
        },
        generationJob: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Public-safe response (no payment details)
    return NextResponse.json({
      id: order.id,
      status: order.status,
      childName: order.childName,
      storyLength: order.storyLength,
      audioEnabled: order.audioEnabled,
      pdfEnabled: order.pdfEnabled,

      // Generation stages
      textStatus: order.textStatus,
      imageStatus: order.imageStatus,
      audioStatus: order.audioStatus,
      packageStatus: order.packageStatus,

      // Book data if ready
      book: order.status === 'ready' ? {
        title: order.book?.title,
        pages: order.book?.pages?.map(p => ({
          pageNumber: p.pageNumber,
          text: p.text,
        })),
        audioUrl: order.book?.audioAsset?.url,
        pdfUrl: order.book?.pdfUrl,
        readUrl: order.book?.readUrl,
      } : null,

      // Progress %
      progress: computeProgress(order),
    });

  } catch (error) {
    console.error('[GET /api/orders/[id]]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function computeProgress(order: any): number {
  let done = 0;
  const total = order.audioEnabled ? 4 : 3;

  if (order.textStatus === 'done') done++;
  if (order.imageStatus === 'done') done++;
  if (!order.audioEnabled || order.audioStatus === 'done') done++;
  if (order.packageStatus === 'done') done++;

  return Math.round((done / total) * 100);
}
