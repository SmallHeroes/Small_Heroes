import { createRequire } from 'module';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
const config = createRequire(resolve('package.json'))(resolve('next.config.js'));
describe('Q3 runtime tracing for actual engine acceptance/media entrypoints', () => {
  it.each(['/api/engine-site/v1/cron/reconcile', '/api/engine-site/v1/review/[orderId]', '/api/generate/worker',
    '/api/generate/cron/outbox','/api/generate/cron/exceptions','/api/generate/cron/sweep'])('%s carries every dynamic disk dependency', route => {
    const files: string[] = Object.entries(config.outputFileTracingIncludes).filter(([key]) => key === route ||
      key === '/api/engine-site/v1/**' && route.startsWith('/api/engine-site/v1/')).flatMap(([,v]) => v as string[]);
    for (const pattern of ['./style-references/01/**/*', './style-references/01-child-template/**/*', './backend/assets/fonts/**/*',
      './node_modules/@ffmpeg-installer/**/*', './node_modules/@ffprobe-installer/**/*', './public/companions/*/style01-sheets/**/*'])
      expect(files, `${route}: ${pattern}`).toContain(pattern);
    const excluded:string[]=Object.entries(config.outputFileTracingExcludes).filter(([key])=>key===route||key==='/api/engine-site/v1/**'&&route.startsWith('/api/engine-site/v1/')).flatMap(([,v])=>v as string[]);
    expect(excluded).not.toContain('./node_modules/@ffmpeg-installer/**/*');
    expect(excluded).not.toContain('./node_modules/@ffprobe-installer/**/*');
    expect(excluded).not.toContain('./style-references/**/*');
    expect(excluded).not.toContain('./public/**/*');
  });
});
