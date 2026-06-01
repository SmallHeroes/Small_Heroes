import { NextRequest, NextResponse } from 'next/server';
import { devOnlyJsonError, isDevEnvironment } from '@/lib/dev-only-guard';
import {
  friendlyQaError,
  QA_CONSOLE_MAX_PAGES,
  runQaConsoleRender,
  type QaConsoleChildInput,
} from '@/lib/qa-console-run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RunBody = {
  storyKey?: string;
  pages?: number[];
  childPreset?: 'noam' | 'mia';
  child?: {
    name?: string;
    gender?: 'boy' | 'girl';
    age?: number;
  };
  childPhotoBase64?: string;
  quality?: 'low' | 'medium';
  voiceId?: string | null;
  generateAudio?: boolean;
  promptAuditOnly?: boolean;
};

function normalizePhotoDataUrl(raw?: string): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('data:') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
}

function resolveChild(body: RunBody): QaConsoleChildInput {
  const photoDataUrl = normalizePhotoDataUrl(body.childPhotoBase64);

  if (body.childPreset === 'noam') {
    return { preset: 'noam', photoDataUrl };
  }
  if (body.childPreset === 'mia') {
    return { preset: 'mia', photoDataUrl };
  }
  if (body.child?.name?.trim()) {
    return {
      name: body.child.name.trim(),
      gender: body.child.gender === 'girl' ? 'girl' : 'boy',
      age: Number.parseInt(String(body.child.age ?? 5), 10) || 5,
      photoDataUrl,
    };
  }
  if (photoDataUrl) {
    throw new Error('Photo upload requires child preset (noam/mia) or custom child fields');
  }
  return { preset: 'noam' };
}

export async function POST(req: NextRequest) {
  if (!isDevEnvironment()) return devOnlyJsonError();

  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const storyKey = body.storyKey?.trim();
  if (!storyKey) {
    return NextResponse.json({ error: 'storyKey is required' }, { status: 400 });
  }

  const pages = (body.pages ?? [])
    .map((n) => Number.parseInt(String(n), 10))
    .filter((n) => Number.isFinite(n) && n >= 1);
  if (!pages.length) {
    return NextResponse.json({ error: 'Select at least one page' }, { status: 400 });
  }
  if (pages.length > QA_CONSOLE_MAX_PAGES) {
    return NextResponse.json(
      { error: `Maximum ${QA_CONSOLE_MAX_PAGES} pages per run` },
      { status: 400 }
    );
  }

  const quality = body.quality === 'medium' ? 'medium' : 'low';

  let child: QaConsoleChildInput;
  try {
    child = resolveChild(body);
  } catch (err) {
    return NextResponse.json({ error: friendlyQaError(err) }, { status: 400 });
  }

  try {
    const result = await runQaConsoleRender({
      storyKey,
      pages,
      child,
      quality,
      voiceId: body.voiceId ?? null,
      generateAudio: Boolean(body.generateAudio),
      promptAuditOnly: Boolean(body.promptAuditOnly),
    });

    return NextResponse.json({
      ok: true,
      ...result,
      previewPath: result.previewUrl,
    });
  } catch (err) {
    console.error('[qa-console/run]', err);
    return NextResponse.json({ error: friendlyQaError(err) }, { status: 500 });
  }
}
