import canonicalConfig from '../vitest.config';

// Explicit include replacement: these intentionally failing controls must never
// enter canonical discovery. All other policy (including the runner) is inherited.
export default {
  ...canonicalConfig,
  test: {
    ...canonicalConfig.test,
    include: ['lib/__tests__/fixtures/cooperative-runner.fixture.ts'],
  },
};
