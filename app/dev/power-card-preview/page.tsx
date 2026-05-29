import fs from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import PowerCardPreview from '@/app/book/[id]/read-v2/components/PowerCardPreview';
import { getCompanionById } from '@/lib/companions';
import {
  GOLDEN_SHELF_STORY_DIR,
  paletteForDirection,
  parseAndValidateStoryPowerCard,
  resolvePowerCard,
  type PowerCardRenderInput,
} from '@/lib/power-cards';

export const dynamic = 'force-dynamic';

const STORY_BANK_DIR = path.join(process.cwd(), GOLDEN_SHELF_STORY_DIR);

/** Short companion names as used in golden-shelf stories (not the long catalog label). */
const COMPANION_SHORT_NAMES: Record<string, string> = {
  bat_lily: 'לילי',
  fox_uri: 'אורי',
  dragon_dini: 'דיני',
};

type SampleConfig = {
  slug: string;
  childName: string;
  childGender: 'male' | 'female';
  bookTitle: string;
};

const SAMPLES: SampleConfig[] = [
  {
    slug: 'bat_lily_bedtime',
    childName: 'נועה',
    childGender: 'female',
    bookTitle: 'נועה ולילי מקשיבים למה שעובר',
  },
  {
    slug: 'fox_uri_adventure',
    childName: 'איתי',
    childGender: 'male',
    bookTitle: 'איתי ומפת הצללים',
  },
  {
    slug: 'dragon_dini_fantasy',
    childName: 'מיה',
    childGender: 'female',
    bookTitle: 'מיה ודיני במערת האבנים החמות',
  },
];

async function loadSampleInput(config: SampleConfig): Promise<PowerCardRenderInput> {
  const filePath = path.join(STORY_BANK_DIR, `${config.slug}.md`);
  const markdown = await fs.readFile(filePath, 'utf8');
  const parsed = parseAndValidateStoryPowerCard(markdown, config.slug);
  if (!parsed.spec) {
    const detail = parsed.issues.map((i) => i.message).join('; ');
    throw new Error(`Missing powerCard spec in ${config.slug}: ${detail}`);
  }

  const resolved = resolvePowerCard({ powerCard: parsed.spec });
  const companionId = config.slug.replace(/_(bedtime|adventure|fantasy)$/, '');
  const directionMatch = config.slug.match(/_(bedtime|adventure|fantasy)$/);
  const direction = (directionMatch?.[1] ?? 'bedtime') as 'bedtime' | 'adventure' | 'fantasy';
  const companion = getCompanionById(companionId);

  return {
    spec: resolved,
    childName: config.childName,
    childGender: config.childGender,
    companionName: COMPANION_SHORT_NAMES[companionId] ?? companion?.name ?? companionId,
    companionAvatarUrl: companion?.image ?? '/companions/bolly_armadillo/reference.jpg',
    palette: paletteForDirection(direction),
    bookTitle: config.bookTitle,
  };
}

export default async function PowerCardPreviewDevPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const inputs = await Promise.all(SAMPLES.map((sample) => loadSampleInput(sample)));

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 24px 48px',
        background: '#111827',
        color: '#f9fafb',
        fontFamily: 'var(--font-heebo), Heebo, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600 }}>Power Card — Dev Preview</h1>
        <p style={{ margin: '0 0 28px', color: '#9ca3af', maxWidth: 640, lineHeight: 1.5 }}>
          PR-4 / phase 3b — React preview only. Three golden-shelf samples (bedtime, adventure,
          fantasy) with palette tokens from the brief. Gender slashes resolved per sample child.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {inputs.map((input) => (
            <section key={input.spec.coreTool} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#d1d5db' }}>
                {input.palette} · {input.childGender === 'female' ? 'girl' : 'boy'} · {input.childName}
              </h2>
              <PowerCardPreview input={input} />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
