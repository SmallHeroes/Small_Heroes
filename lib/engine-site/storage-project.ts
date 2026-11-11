import 'server-only';

/** Bind the policy database used by Prisma to the matching hosted Storage project. */
export function assertEngineStorageProjectBinding(storageUrl: string | undefined, databaseUrl: string | undefined) {
  try {
    const api = new URL(storageUrl ?? ''), db = new URL(databaseUrl ?? '');
    if ([...db.searchParams.keys()].some(key => ['host', 'hostaddr'].includes(key.toLowerCase())))
      throw Error('engine_private_project_mismatch');
    const project = /^([a-z0-9]{20})\.supabase\.co$/.exec(api.hostname)?.[1];
    const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/.exec(db.hostname)?.[1];
    const pooler = /(^|\.)pooler\.supabase\.com$/.test(db.hostname)
      ? /^[A-Za-z0-9_]+\.([a-z0-9]{20})$/.exec(decodeURIComponent(db.username))?.[1] : undefined;
    if (api.protocol !== 'https:' || !['postgres:', 'postgresql:'].includes(db.protocol) || !project || (direct ?? pooler) !== project)
      throw Error('engine_private_project_mismatch');
  } catch {
    throw Error('engine_private_project_mismatch');
  }
}
