import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry === 'dev' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

function source(relative: string): string {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('P1-f #5 delivery-input writer coverage', () => {
  const requiredBarrierFiles = [
    'lib/generation-pipeline/text-finalization.ts',
    'lib/generation-pipeline/chunk-runner.ts',
    'lib/single-page-image-regen.ts',
    'lib/generation-chunked/clear-page-images-for-regen.ts',
    'app/api/debug/replicate-image/route.ts',
  ];

  it('all known base-book input writers call the central transactional barrier', () => {
    for (const file of requiredBarrierFiles) {
      expect(source(file), `${file} must use withDeliveryInputMutation`).toContain('withDeliveryInputMutation');
    }
  });

  it('has no unexpected direct Prisma writer bypass for GeneratedBook/BookPage/ImageAsset', () => {
    const directCall = /prisma\.(generatedBook|bookPage|imageAsset)\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
    const found: string[] = [];
    for (const dir of ['app', 'lib']) {
      for (const file of walk(path.join(ROOT, dir))) {
        const relative = path.relative(ROOT, file).split(path.sep).join('/');
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, index) => {
          if (directCall.test(line)) found.push(`${relative}:${index + 1}`);
          directCall.lastIndex = 0;
        });
      }
    }

    // Explicit non-base-input exceptions:
    // - video route writes only GeneratedBook.videoUrl (a later add-on scope);
    // - the two BookPage writes update display-only luminance/layout metadata, never gate/payload inputs.
    const allowed = [
      /^app\/api\/orders\/\[orderId\]\/video\/route\.ts:/,
      /^lib\/generation-pipeline\/chunk-runner\.ts:/,
      /^lib\/single-page-image-regen\.ts:/,
    ];
    expect(found.filter((entry) => !allowed.some((pattern) => pattern.test(entry)))).toEqual([]);
    for (const pattern of allowed) {
      expect(found.filter((entry) => pattern.test(entry))).toHaveLength(1);
    }
    expect(found).toHaveLength(3);
  });

  it('freezes product truth at order creation and removes direct email from chunk-runner', () => {
    expect(source('app/api/orders/route.ts')).toContain('buildFrozenStoryProductTruth');
    expect(source('lib/generation-pipeline/chunk-runner.ts')).not.toContain('sendBookReadyEmail');
    expect(source('lib/generation-pipeline/chunk-runner.ts')).toContain('finalizePackageDelivery');
  });
});
