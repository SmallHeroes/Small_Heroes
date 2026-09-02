import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { pageRequiresChildIdentity } from '../child-page-presence';

describe('pageRequiresChildIdentity', () => {
  it('uses structured package authority for canonical child ids', () => {
    expect(pageRequiresChildIdentity({
      runtimeBlueprintFrame: {
        entityPresence: {
          childPresence: 'present',
          companionPresence: 'absent',
          recurringObjects: [],
          recurringEntities: [],
          forbiddenEntities: [],
        },
      },
      expectedCharacterIds: ['child:hero'],
    })).toBe(true);
  });

  it('does not let a stale cast id override authoritative absence', () => {
    expect(pageRequiresChildIdentity({
      runtimeBlueprintFrame: {
        entityPresence: {
          childPresence: 'absent',
          companionPresence: 'present',
          recurringObjects: [],
          recurringEntities: [],
          forbiddenEntities: [],
        },
      },
      expectedCharacterIds: ['child'],
    })).toBe(false);
  });

  it('preserves the legacy literal child contract', () => {
    expect(pageRequiresChildIdentity({ expectedCharacterIds: ['child'] })).toBe(true);
    expect(pageRequiresChildIdentity({ expectedCharacterIds: ['child:hero'] })).toBe(false);
  });

  it('the delivered-page caller uses frozen runtime authority and never promotes legacy pages from style metadata', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/generation-pipeline/chunk-runner.ts'),
      'utf8',
    );
    const delivered = source.slice(
      source.indexOf('const deliveredRuntimeFrame'),
      source.indexOf('const rawPageResemblance'),
    );
    expect(delivered).toContain('earlyRuntimeAuthority');
    expect(delivered).toContain('runtimeBlueprintFrame: deliveredRuntimeFrame');
    expect(delivered).not.toContain('style01Meta?.entityPresence');
  });
});
