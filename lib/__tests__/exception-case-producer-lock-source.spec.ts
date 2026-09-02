import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('ExceptionCase producer Order-first lock coverage', () => {
  it('keeps the direct-client wrapper and the fenced Outbox producer inside one Order-locked transaction', () => {
    const text = source('lib/generation-chunked/exception-case.ts');
    expect(text).toMatch(
      /return \(db as PrismaClient\)\.\$transaction[\s\S]*?lockOrderForExceptionCase\(tx, args\.orderId\)[\s\S]*?openExceptionCaseWithOrderLock\(tx, args\)/,
    );
    expect(text).toContain('orderLock.transaction !== db');
    expect(text).toMatch(
      /fencedOutboxTerminalWithException[\s\S]*?prisma\.\$transaction[\s\S]*?lockOrderForExceptionCase\(tx, args\.row\.orderId\)[\s\S]*?deliveryOutbox\.updateMany[\s\S]*?openExceptionCase\(tx,[\s\S]*?orderLock\)/,
    );
  });

  it('takes the Order lock before GenerationJob/Order failure writes in every chunk-runner producer transaction', () => {
    const text = source('lib/generation-pipeline/chunk-runner.ts');
    expect(text.match(/openExceptionCase\(tx,/g)).toHaveLength(3);
    expect(text.match(/lockOrderForExceptionCase\(tx,/g)).toHaveLength(3);
    expect(text).toMatch(
      /Page \$\{pn\} failed[\s\S]*?\$transaction\(async \(tx\)[\s\S]*?lockOrderForExceptionCase\(tx, order\.id\)[\s\S]*?tx\.generationJob\.update[\s\S]*?openExceptionCase\(tx,[\s\S]*?exceptionOrderLock!\)/,
    );
    expect(text).toMatch(
      /isOutcomeUnknown\(error\)[\s\S]*?\$transaction\(async \(tx\)[\s\S]*?lockOrderForExceptionCase\(tx, orderId\)[\s\S]*?openExceptionCase\(tx,[\s\S]*?exceptionOrderLock\)/,
    );
    expect(text).toMatch(
      /log\.error\('Chunk failed'[\s\S]*?\$transaction\(async \(tx\)[\s\S]*?lockOrderForExceptionCase\(tx, orderId\)[\s\S]*?tx\.generationJob\.update[\s\S]*?openExceptionCase\(tx,[\s\S]*?exceptionOrderLock!\)/,
    );
  });

  it('takes the Order lock first in the sweeper and readiness producer transactions', () => {
    const sweeper = source('lib/generation-chunked/sweeper.ts');
    expect(sweeper).toMatch(
      /const hardFailed = await prisma\.\$transaction\(async \(tx\)[\s\S]*?lockOrderForExceptionCase\(tx, job\.orderId\)[\s\S]*?tx\.generationJob\.[\s\S]*?openExceptionCase\(tx,[\s\S]*?exceptionOrderLock!\)/,
    );

    const readiness = source('lib/generation-pipeline/readiness-manifest.ts');
    expect(readiness).toMatch(
      /async function runReadinessTxn[\s\S]*?lockOrderForExceptionCase\(tx, args\.orderId\)[\s\S]*?loadCommitInputs\([\s\S]*?tx,[\s\S]*?args\.orderId,[\s\S]*?loaded\.humanReviewByteAuthority,[\s\S]*?\)[\s\S]*?openExceptionCase\(tx,[\s\S]*?exceptionOrderLock\)/,
    );
  });

  it('keeps terminal backfill producers on the direct PrismaClient wrapper', () => {
    const text = source('lib/generation-chunked/exception-processor.ts');
    const sync = text.slice(text.indexOf('export async function syncTerminalExceptionCases'));
    expect(sync.match(/openExceptionCase\(prisma,/g)).toHaveLength(2);
    expect(sync).not.toContain('openExceptionCase(tx,');
  });
});
