import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

import { GET } from '../../app/api/wizard/mvp-matrix/route';

const require = createRequire(import.meta.url);
const nextConfig = require('../../next.config.js') as {
  outputFileTracingIncludes?: Record<string, string[]>;
};

describe('GET /api/wizard/mvp-matrix', () => {
  const originalBank = process.env.ENABLE_V3_APPROVED_BANK;
  const originalQaCatalog = process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;

  beforeEach(() => {
    process.env.ENABLE_V3_APPROVED_BANK = 'true';
    process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = 'true';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalBank === undefined) delete process.env.ENABLE_V3_APPROVED_BANK;
    else process.env.ENABLE_V3_APPROVED_BANK = originalBank;
    if (originalQaCatalog === undefined) delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
    else process.env.ENABLE_WIZARD_QA_RENDER_CATALOG = originalQaCatalog;
  });

  it('bundles the committed QA catalog into the Vercel matrix function', () => {
    expect(nextConfig.outputFileTracingIncludes?.['/api/wizard/mvp-matrix']).toEqual([
      './qa-authorities/wizard/**/*',
    ]);
  });

  it('returns exactly 6 public MVP categories with companions', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories).toHaveLength(6);
    expect(body.header?.title).toMatch(/בחרו את האתגר/);

    const night = body.categories.find((c: { category: string }) => c.category === 'NIGHT_FEAR');
    expect(night?.companion?.id).toBe('fox_uri');
    expect(night?.companion?.image).toBe('/companions/fox_uri/style01-sheets/front.png');
    expect(night?.directions?.bedtime?.sellable).toBe(true);
    expect(night?.directions?.fantasy?.sellable).toBe(true);
    expect(night?.directions?.fantasy?.storyReady).toBe(true);
    expect(night?.directions?.fantasy?.qaAuthoringReady).toBe(true);
    expect(night?.directions?.fantasy?.productionRenderQualified).toBe(false);
    expect(night?.directions?.fantasy?.selectable).toBe(true);
    expect(night?.directions?.fantasy?.availabilityStage).toBe(
      'qa_ready_for_blueprint_authoring',
    );
  });

  it('exposes sellable directions per category for wizard direction step', async () => {
    const res = await GET();
    const body = await res.json();
    const medical = body.categories.find(
      (c: { category: string }) => c.category === 'MEDICAL_PROCEDURE'
    );
    expect(medical?.directions?.adventure?.sellable).toBe(true);
    const social = body.categories.find((c: { category: string }) => c.category === 'SOCIAL');
    expect(social?.directions?.adventure?.sellable).toBe(true);
    expect(social?.directions?.bedtime?.sellable).toBe(true);
  });

  it('exposes no QA candidate authority when the explicit QA flag is off', async () => {
    delete process.env.ENABLE_WIZARD_QA_RENDER_CATALOG;
    const res = await GET();
    const body = await res.json();
    for (const category of body.categories) {
      for (const direction of Object.values(category.directions) as Array<{
        qaAuthoringReady: boolean;
        productionRenderQualified: boolean;
        selectable: boolean;
      }>) {
        expect(direction.qaAuthoringReady).toBe(false);
        expect(direction.productionRenderQualified).toBe(false);
        expect(direction.selectable).toBe(false);
      }
    }
  });

  it('keeps every slot unavailable in real Production despite QA flags', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('ALLOW_STAGING_QA', 'true');
    vi.stubEnv('ENABLE_V3_APPROVED_BANK', 'true');
    vi.stubEnv('ENABLE_WIZARD_QA_RENDER_CATALOG', 'true');
    const res = await GET();
    const body = await res.json();
    for (const category of body.categories) {
      for (const direction of Object.values(category.directions) as Array<{
        qaAuthoringReady: boolean;
        productionRenderQualified: boolean;
        selectable: boolean;
      }>) {
        expect(direction.qaAuthoringReady).toBe(false);
        expect(direction.productionRenderQualified).toBe(false);
        expect(direction.selectable).toBe(false);
      }
    }
  });
});
