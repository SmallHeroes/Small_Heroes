import fs from 'fs/promises';
import path from 'path';
import { notFound } from 'next/navigation';
import { getCompanionById } from '@/lib/companions';
import { isDevEnvironment } from '@/lib/dev-only-guard';
import {
  GOLDEN_SHELF_STORY_DIR,
  paletteForDirection,
  parseAndValidateStoryPowerCard,
  resolvePowerCard,
  type PowerCardRenderInput,
} from '@/lib/power-cards';
import {
  PowerCardEndScreenDevGallery,
  type PowerCardEndScreenDevSample,
} from './PowerCardEndScreenDevGallery';

export const dynamic = 'force-dynamic';

const STORY_BANK_DIR = path.join(process.cwd(), GOLDEN_SHELF_STORY_DIR);

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
  label: string;
};

const SAMPLES: SampleConfig[] = [
  {
    slug: 'bat_lily_bedtime',
    label: 'moonlit · bedtime · bat_lily',
    childName: 'נועה',
    childGender: 'female',
    bookTitle: 'נועה ולילי מקשיבים למה שעובר',
  },
  {
    slug: 'fox_uri_adventure',
    label: 'earth-warm · adventure · fox_uri',
    childName: 'איתי',
    childGender: 'male',
    bookTitle: 'איתי ומפת הצללים',
  },
  {
    slug: 'dragon_dini_fantasy',
    label: 'magical-cool · fantasy · dragon_dini',
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

export default async function PowerCardEndScreenDevPage() {
  if (!isDevEnvironment()) {
    notFound();
  }

  const samples: PowerCardEndScreenDevSample[] = await Promise.all(
    SAMPLES.map(async (config) => ({
      label: config.label,
      input: await loadSampleInput(config),
    }))
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 24px 48px',
        background: '#e8e0d4',
        color: '#4a4036',
        fontFamily: 'var(--font-heebo), Heebo, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 600 }}>
          Power Card — End Screen Dev
        </h1>
        <p style={{ margin: '0 0 28px', color: '#6b5f52', maxWidth: 720, lineHeight: 1.5 }}>
          PR-5 / phase 3d — reader end-screen integration. Three golden-shelf samples in reader
          chrome. PDF/PNG links are placeholders (no real order). Click המשך to preview the
          following סיימת screen stub.
        </p>

        <PowerCardEndScreenDevGallery samples={samples} />
      </div>
    </main>
  );
}
