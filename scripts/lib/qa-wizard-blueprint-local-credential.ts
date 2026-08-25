import fs from 'node:fs';
import path from 'node:path';

const MAX_CREDENTIAL_SOURCE_BYTES = 64 * 1024;
const OPENAI_CREDENTIAL_KEY = 'OPENAI_API_KEY';
const SAFE_CREDENTIAL_VALUE = /^\S{20,512}$/;

function invalidCredentialSource(): never {
  throw new Error('credential_source_invalid');
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const normalized = path.normalize(value);
    return process.platform === 'win32'
      ? normalized.toLowerCase()
      : normalized;
  };
  return normalize(left) === normalize(right);
}

function parseFocusedValue(rawValue: string): string {
  const raw = rawValue.trim();
  if (raw.startsWith("'")) {
    const match = raw.match(/^'([^']*)'\s*(?:#.*)?$/);
    if (!match) invalidCredentialSource();
    return match[1]!;
  }
  if (raw.startsWith('"')) {
    const match = raw.match(/^"((?:\\.|[^"\\])*)"\s*(?:#.*)?$/);
    if (!match) invalidCredentialSource();
    return match[1]!
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  return raw.replace(/\s+#.*$/, '').trim();
}

function parseOpenAICredential(source: string): string {
  let credential: string | null = null;
  for (const line of source.split(/\r?\n/)) {
    const assignment = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/,
    );
    if (!assignment || assignment[1] !== OPENAI_CREDENTIAL_KEY) continue;
    if (credential !== null) invalidCredentialSource();
    credential = parseFocusedValue(assignment[2]!);
  }
  if (credential === null || !SAFE_CREDENTIAL_VALUE.test(credential)) {
    invalidCredentialSource();
  }
  return credential;
}

export interface LazyLocalOpenAICredentialReaderHooks {
  /** Test-only observation immediately before the first credential-source access. */
  beforeCredentialSourceRead?: () => void;
}

/**
 * Returns a single-value reader without touching the filesystem. The first
 * invocation verifies and reads one absolute, unique regular file, extracts
 * only OPENAI_API_KEY, and caches that value for the admitted adapter.
 */
export function createLazyLocalOpenAICredentialReader(args: {
  credentialFilePath: string;
  hooks?: LazyLocalOpenAICredentialReaderHooks;
}): () => string {
  const requestedPath = args.credentialFilePath;
  let cachedCredential: string | null = null;
  return () => {
    if (cachedCredential !== null) return cachedCredential;
    args.hooks?.beforeCredentialSourceRead?.();
    try {
      if (!path.isAbsolute(requestedPath)) invalidCredentialSource();
      const absolutePath = path.resolve(requestedPath);
      const lexical = fs.lstatSync(absolutePath);
      if (
        !lexical.isFile() ||
        lexical.isSymbolicLink() ||
        lexical.nlink !== 1 ||
        lexical.size <= 0 ||
        lexical.size > MAX_CREDENTIAL_SOURCE_BYTES
      ) {
        invalidCredentialSource();
      }
      const realPath = fs.realpathSync.native(absolutePath);
      if (!samePath(absolutePath, realPath)) invalidCredentialSource();
      const descriptor = fs.openSync(absolutePath, 'r');
      try {
        const opened = fs.fstatSync(descriptor);
        if (
          !opened.isFile() ||
          opened.nlink !== 1 ||
          opened.size !== lexical.size ||
          opened.dev !== lexical.dev ||
          opened.ino !== lexical.ino
        ) {
          invalidCredentialSource();
        }
        cachedCredential = parseOpenAICredential(
          fs.readFileSync(descriptor, 'utf8'),
        );
      } finally {
        fs.closeSync(descriptor);
      }
      return cachedCredential;
    } catch {
      return invalidCredentialSource();
    }
  };
}
