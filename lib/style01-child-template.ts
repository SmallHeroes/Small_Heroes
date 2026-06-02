import { existsSync } from 'fs';
import path from 'path';

export const STYLE01_CHILD_TEMPLATE_DIR = path.join(
  process.cwd(),
  'style-references',
  '01-child-template'
);

export type Style01ChildTemplateVariant = 'girl' | 'boy';

function envTemplatePath(variant: Style01ChildTemplateVariant): string | null {
  const key = variant === 'girl' ? 'STYLE01_CHILD_TEMPLATE_GIRL' : 'STYLE01_CHILD_TEMPLATE_BOY';
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
}

/** Resolved filesystem path to the approved Style 01 child template image. */
export function resolveStyle01ChildTemplatePath(
  childGender: string | null | undefined
): string {
  const variant: Style01ChildTemplateVariant = childGender === 'boy' ? 'boy' : 'girl';
  const fromEnv = envTemplatePath(variant);
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const defaultPath = path.join(STYLE01_CHILD_TEMPLATE_DIR, `${variant}.png`);
  if (existsSync(defaultPath)) return defaultPath;

  throw new Error(
    `Style 01 child template missing for variant="${variant}". ` +
      `Place ${variant}.png in ${STYLE01_CHILD_TEMPLATE_DIR} or run scripts/generate-style01-child-template.ts ${variant}`
  );
}

export function listStyle01ChildTemplateStatus(): Record<Style01ChildTemplateVariant, boolean> {
  return {
    girl: existsSync(envTemplatePath('girl') ?? path.join(STYLE01_CHILD_TEMPLATE_DIR, 'girl.png')),
    boy: existsSync(envTemplatePath('boy') ?? path.join(STYLE01_CHILD_TEMPLATE_DIR, 'boy.png')),
  };
}
