import { describe, expect, it } from 'vitest';

import { GET } from '../../app/api/wizard/mvp-matrix/route';

describe('GET /api/wizard/mvp-matrix', () => {
  it('returns exactly 6 public MVP categories with companions', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categories).toHaveLength(6);
    expect(body.header?.title).toMatch(/בחרו את האתגר/);

    const night = body.categories.find((c: { category: string }) => c.category === 'NIGHT_FEAR');
    expect(night?.companion?.id).toBe('fox_uri');
    expect(night?.directions?.bedtime?.sellable).toBe(true);
    expect(night?.directions?.fantasy?.sellable).toBe(false);
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
    expect(social?.directions?.bedtime?.sellable).toBe(false);
  });
});
