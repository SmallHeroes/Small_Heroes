/**
 * GET /api/wizard/product-truth?companionId=…&direction=…
 *
 * Returns the server-resolved product (direction/pages/price) for the story
 * that will actually be served, so the wizard summary always matches the book
 * and the charge. Same resolver the orders API uses — UI cannot drift.
 */

import { NextResponse } from 'next/server';
import {
  resolveStoryProductTruth,
  StoryProductResolutionError,
} from '../../../../backend/providers/story-product-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  try {
    const resolved = resolveStoryProductTruth({
      companionId: searchParams.get('companionId'),
      clientDirection: searchParams.get('direction'),
      legacyLength: searchParams.get('length'),
    });
    return NextResponse.json({
      direction: resolved.storyDirection,
      // BEATS — generation units. UI must never render this number directly.
      pages: resolved.pages,
      // PHYSICAL pages (beats × 2) — the only number the UI displays.
      displayPages: resolved.displayPages,
      priceILS: resolved.priceILS,
      source: resolved.source,
    });
  } catch (error) {
    if (error instanceof StoryProductResolutionError) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    console.error('[GET /api/wizard/product-truth]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
