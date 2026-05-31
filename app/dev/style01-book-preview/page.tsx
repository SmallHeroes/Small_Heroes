import { Style01BookPreviewClient } from './Style01BookPreviewClient';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function Style01BookPreviewPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const dir = asSingle(query.dir)?.trim();
  const root = asSingle(query.root)?.trim() as 'phase2-logs' | 'outputs' | undefined;

  return <Style01BookPreviewClient initialDir={dir} initialRoot={root} />;
}
