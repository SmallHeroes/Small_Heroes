import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { POST } from '@/app/api/dev/personal-wizard/request/route';
import { VOICES } from '@/backend/config/voices';

import type { ReviewedPersonalBookRequest } from '../contract';
import {
  addTypedFact,
  buildReviewedRequest,
  confirmFactsReview,
  createDraft,
  setChildAddress,
  setChildAge,
  setChildName,
  setCompanion,
  setIntent,
  setPackage,
  setVoice,
} from '../draft';
import { PROTOTYPE_COMPANION_ROSTER, resolvePersonalWizardOptions } from '../options';
import { acceptPersonalBookRequest, canonicalJson } from '../request-acceptance';

const options = resolvePersonalWizardOptions();

function validRequest(): ReviewedPersonalBookRequest {
  let counter = 0;
  const makeId = (prefix: 'd' | 'f' | 'j' | 'c') => `${prefix}_${String((counter += 1)).padStart(8, '0')}`;
  let draft = createDraft('d_00000000test');
  draft = setChildAddress(setChildAge(setChildName(draft, 'נועה'), 4), 'girl');
  draft = addTypedFact(draft, 'interest', 'ציור', makeId).draft;
  draft = confirmFactsReview(draft);
  draft = setIntent(setCompanion(draft, 'panda_anat'), { kind: 'topic', topicId: 'social' });
  draft = setVoice(setPackage(draft, 'adventure'), 'mom');
  const built = buildReviewedRequest(draft);
  if (!built.ok) throw new Error('fixture request invalid');
  return built.request;
}

describe('resolvePersonalWizardOptions', () => {
  it('offers the configured roster with on-disk card art, existing voices and catalogue page counts', () => {
    expect(options.companions.map((companion) => companion.id)).toEqual(PROTOTYPE_COMPANION_ROSTER.map((entry) => entry.id));
    expect(options.unavailableCompanionIds).toEqual([]);
    for (const companion of options.companions) {
      expect(companion.name.length).toBeGreaterThan(0);
      expect(companion.image).toMatch(/^\/companions\//);
      expect(companion.personality).not.toMatch(/[–—]/);
    }
    expect(options.voices.map((voice) => voice.id)).toEqual(VOICES.map((voice) => voice.id));
    expect(options.voices.find((voice) => voice.id === 'dad_v2')?.sampleUrl).toBeNull();
    expect(options.packages.map((pkg) => [pkg.id, pkg.pages])).toEqual([
      ['bedtime', 16],
      ['adventure', 24],
      ['fantasy', 32],
    ]);
    expect(options.topics.map((topic) => topic.id)).toContain('transitions');
    expect(options.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(resolvePersonalWizardOptions().fingerprint).toBe(options.fingerprint);
  });

  it('fails closed: companions without card art on disk are not offered', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'pw-options-'));
    try {
      const bare = resolvePersonalWizardOptions(emptyRoot);
      expect(bare.companions).toEqual([]);
      expect(bare.unavailableCompanionIds).toEqual(PROTOTYPE_COMPANION_ROSTER.map((entry) => entry.id));
      expect(bare.voices.every((voice) => voice.sampleUrl === null)).toBe(true);
      expect(bare.fingerprint).not.toBe(options.fingerprint);
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});

describe('acceptPersonalBookRequest', () => {
  it('accepts a browser-built request and derives a deterministic content-bound identity', () => {
    const request = validRequest();
    const first = acceptPersonalBookRequest(request, options);
    const second = acceptPersonalBookRequest(JSON.parse(JSON.stringify(request)), options);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.requestId).toMatch(/^[0-9a-f]{64}$/);
    expect(second.requestId).toBe(first.requestId);
    expect(first.writer).toBe('not_connected');
    expect(first.containsFixtureData).toBe(false);

    const changed = acceptPersonalBookRequest({ ...request, avoid: ['בלי חושך'] }, options);
    expect(changed.ok && changed.requestId).not.toBe(first.requestId);
    const otherOptions = acceptPersonalBookRequest(request, { ...options, fingerprint: 'f'.repeat(64) });
    expect(otherOptions.ok && otherOptions.requestId).not.toBe(first.requestId);
  });

  it('rejects authority fields, unknown options and malformed content', () => {
    const request = validRequest();
    const cases: Array<[string, unknown]> = [
      ['approval flag', { ...request, approved: true }],
      ['budget', { ...request, budgetUsd: 1 }],
      ['nested authority', { ...request, companion: { id: 'panda_anat', runtimeEligible: true } }],
      ['unknown companion', { ...request, companion: { id: 'octopus_seara' } }],
      ['unknown topic', { ...request, intent: { kind: 'topic', topicId: 'other' } }],
      ['fake OTHER category', { ...request, intent: { kind: 'topic', topicId: 'OTHER' } }],
      ['unknown voice', { ...request, bookOptions: { packageId: null, voiceId: 'clone_of_parent' } }],
      ['unknown package', { ...request, bookOptions: { packageId: 'long_12', voiceId: null } }],
      ['un-normalized text', { ...request, avoid: ['  בלי חושך'] }],
      ['address other', { ...request, child: { ...request.child, address: 'other' } }],
      ['age 2', { ...request, child: { ...request.child, age: 2 } }],
      ['name with digits', { ...request, child: { ...request.child, name: 'נועה2' } }],
      [
        'duplicate fact value',
        { ...request, facts: [...request.facts, { ...request.facts[0], id: 'f_99999999' }] },
      ],
      ['wrong version', { ...request, version: 'reviewed-personal-book-request/v0' }],
    ];
    for (const [label, input] of cases) {
      const result = acceptPersonalBookRequest(input, options);
      expect(result.ok, label).toBe(false);
    }
  });

  it('reports fixture provenance so example data is never mistaken for parent input', () => {
    const request = validRequest();
    const withFixture = {
      ...request,
      facts: [...request.facts, { id: 'f_99999999', kind: 'residence', value: 'קיבוץ', source: 'fixture' }],
    };
    const result = acceptPersonalBookRequest(withFixture, options);
    expect(result.ok && result.containsFixtureData).toBe(true);
  });

  it('canonical JSON is key-order independent and keeps array order', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('POST /api/dev/personal-wizard/request', () => {
  const previous = process.env.PERSONAL_WIZARD_PREVIEW;
  beforeEach(() => {
    process.env.PERSONAL_WIZARD_PREVIEW = 'true';
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.PERSONAL_WIZARD_PREVIEW;
    else process.env.PERSONAL_WIZARD_PREVIEW = previous;
  });

  const call = (body: string, headers: Record<string, string> = {}) =>
    POST(
      new NextRequest('http://localhost:3000/api/dev/personal-wizard/request', {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200) + 1}`,
          ...headers,
        },
      }),
    );

  it('is not found unless the explicit preview flag is on', async () => {
    delete process.env.PERSONAL_WIZARD_PREVIEW;
    const response = await call(JSON.stringify(validRequest()));
    expect(response.status).toBe(404);
  });

  it('accepts a valid request without persisting anything and returns the server identity', async () => {
    const response = await call(JSON.stringify(validRequest()));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ status: 'accepted_preview', writer: 'not_connected', containsFixtureData: false });
    expect(body.requestId).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects cross-origin, oversized, malformed and authority-carrying requests', async () => {
    expect((await call(JSON.stringify(validRequest()), { origin: 'https://evil.example' })).status).toBe(403);
    expect((await call('x'.repeat(40 * 1024))).status).toBe(413);
    expect((await call('{not json')).status).toBe(400);
    const authority = await call(JSON.stringify({ ...validRequest(), approved: true }));
    expect(authority.status).toBe(422);
    expect((await authority.json()).status).toBe('rejected');
  });
});
