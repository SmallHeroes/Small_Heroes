import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * P0 guard: the Vercel build MUST regenerate the Prisma client, or the deployed client goes stale
 * after a schema change (e.g. the GenerationJob reliability fields) and every generationJob query
 * throws PrismaClientValidationError "Unknown field …" → generation never starts. Keep
 * `prisma generate` in the build/install path.
 */
describe('Vercel build regenerates the Prisma client', () => {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const vercel = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8')) as {
    buildCommand?: string;
  };

  it('vercel.json buildCommand runs prisma generate before next build', () => {
    expect(vercel.buildCommand ?? '').toMatch(/prisma\s+generate/);
    expect(vercel.buildCommand ?? '').toContain('next build');
  });

  it('package.json build script runs prisma generate', () => {
    expect(pkg.scripts?.build ?? '').toMatch(/prisma\s+generate/);
  });

  it('package.json postinstall regenerates the client (defense-in-depth)', () => {
    expect(pkg.scripts?.postinstall ?? '').toMatch(/prisma\s+generate/);
  });
});
