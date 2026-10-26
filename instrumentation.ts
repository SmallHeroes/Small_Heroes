import { isLocalUiOnlyBootstrap } from './lib/local-preview-bootstrap';

export async function register() {
  // The explicit loopback UI preview does not use the service runtime. Importing lib/env eagerly
  // would require provider/DB credentials before the provider-free Wizard can even render.
  // Service modules still import and validate lib/env on use; ordinary/cloud startup is unchanged.
  if (isLocalUiOnlyBootstrap()) return;
  const { validateEnv } = await import('./lib/env');
  validateEnv();
}
