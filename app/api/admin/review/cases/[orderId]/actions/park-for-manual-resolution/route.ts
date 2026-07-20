/**
 * POST /api/admin/review/cases/[orderId]/actions/park-for-manual-resolution — the launch-safe endgame (brief §2.7).
 *
 * Freezes a held book for MANUAL resolution: escalates a non-terminal hold to a terminal `manual_resolution_hold:`
 * marker so it can never auto-redrive or ship, keeps the order `needs_human_qa` (customer stays under_review), and
 * leaves the review case OPEN as the visible unresolved record. It ships nothing, enqueues no outbox row, and never
 * touches payment/refund. Auth: GENERATION_SECRET via Bearer / x-generation-secret (header-only — the same gate as
 * the read-only review routes, NOT the legacy body.secret shape). Requires an Idempotency-Key header.
 */
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminSecret } from '@/lib/admin/assert-generation-secret';
import { prisma } from '@/lib/prisma';
import {
  runOperatorAction,
  OperatorActionPreconditionError,
  OperatorActionInputError,
} from '@/lib/human-qa/operator-action';
import { parkOperatorActionBody } from '@/lib/human-qa/operator-park';

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = assertAdminSecret(req); // header/Bearer only — NO body arg (body.secret is never consulted)
  if (denied) return denied;

  const { orderId } = await context.params;
  if (!orderId?.trim()) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const idempotencyKey = req.headers.get('Idempotency-Key')?.trim();
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'Idempotency-Key header required' }, { status: 400 });
  }

  let body: { expectedMarker?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.expectedMarker !== 'string' || !body.expectedMarker.trim()) {
    return NextResponse.json({ error: 'expectedMarker required (the hold marker the operator acted on)' }, { status: 400 });
  }
  const note = typeof body.note === 'string' ? body.note : null;

  try {
    const result = await runOperatorAction(
      prisma,
      { orderId, idempotencyKey, kind: 'park', actor: 'admin:park', expectedMarker: body.expectedMarker, note },
      parkOperatorActionBody,
    );
    return NextResponse.json({ parked: true, actionId: result.actionId, outcome: result.outcome });
  } catch (e) {
    if (e instanceof OperatorActionPreconditionError) {
      return NextResponse.json({ error: e.message, reason: e.reason }, { status: 409 });
    }
    if (e instanceof OperatorActionInputError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
