import { redirect } from 'next/navigation';
import ReaderV2 from './reader-v2';
import { ROUTES } from '@/lib/routes';

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

  return <ReaderV2 bookId={id} accessKey={accessKey} />;
}

