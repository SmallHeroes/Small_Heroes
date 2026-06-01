import { redirect } from 'next/navigation';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function asSingle(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function Style01BookPreviewRedirect({ searchParams }: PageProps) {
  const query = await searchParams;
  const dir = asSingle(query.dir)?.trim();
  const root = asSingle(query.root)?.trim();
  const orderId = asSingle(query.orderId)?.trim();
  const accessKey = asSingle(query.accessKey)?.trim();

  const qs = new URLSearchParams();
  if (dir) qs.set('dir', dir);
  if (root) qs.set('root', root);
  if (orderId) qs.set('orderId', orderId);
  if (accessKey) qs.set('accessKey', accessKey);

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`/dev/viewer${suffix}`);
}
