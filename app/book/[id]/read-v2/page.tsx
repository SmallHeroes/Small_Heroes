import { redirect } from 'next/navigation';
import { SiteHeader } from '@/app/components/SiteHeader';
import ReaderV2 from './reader-v2';
import shellStyles from './read-v2-shell.module.css';
import { ROUTES } from '@/lib/routes';
import '../../../landing/main.css';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function BookReadV2Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const accessKey = asSingle(query.accessKey) || '';
  const enabledByQuery = asSingle(query.v2) === '1' || asSingle(query.v) === '1';
  const enabledByEnv = process.env.NEXT_PUBLIC_READER_V2 === '1';

  if (!enabledByQuery && !enabledByEnv) {
    const keyPart = accessKey ? `&accessKey=${encodeURIComponent(accessKey)}` : '';
    redirect(`${ROUTES.ready}?orderId=${encodeURIComponent(id)}${keyPart}`);
  }

  const devLayoutFlags =
    process.env.NODE_ENV !== 'production'
      ? {
          forceWideSpreadScene: parseOptionalInt(asSingle(query.forceWideSpreadScene)),
          forceWideSpreadPortrait: parseOptionalInt(asSingle(query.forceWideSpreadPortrait)),
        }
      : {};

  return (
    <div className={shellStyles.shell}>
      <div className={shellStyles.headerSlot}>
        <SiteHeader variant="compact" />
      </div>
      <ReaderV2
        source={{ kind: 'order', bookId: id, accessKey }}
        devLayoutFlags={devLayoutFlags}
      />
    </div>
  );
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
