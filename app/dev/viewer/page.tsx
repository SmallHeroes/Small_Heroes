import { notFound } from 'next/navigation';
import { DevBookViewer } from './DevBookViewer';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function DevViewerPage({ searchParams }: PageProps) {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const query = await searchParams;
  const dir = asSingle(query.dir)?.trim();
  const root = asSingle(query.root)?.trim() as 'phase2-logs' | 'outputs' | undefined;
  const orderId = asSingle(query.orderId)?.trim();
  const accessKey = asSingle(query.accessKey)?.trim();

  return (
    <DevBookViewer
      initialDir={dir}
      initialRoot={root}
      initialOrderId={orderId}
      initialAccessKey={accessKey}
    />
  );
}
